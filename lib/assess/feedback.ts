// Feedback after Submit: two parts (common, career). ELO and bars are deterministic and shown at once; this text is generated
// server-side right after Submit, stored with provider/model/prompt version, and ALWAYS has a deterministic template fallback so the
// popup is never blank.

import { generateStructured, type GenerateDeps } from "@/lib/ai/llm";
import { FEEDBACK_PROMPT_VERSION, FeedbackSchema, feedbackPrompt, feedbackToneOk, type Feedback } from "@/lib/ai/llm/prompts/feedback.v1";
import type { Db } from "./db";
import { track } from "./db";
import type { SectionBar, SkillResult } from "./scoring";
import { developmentPhrase } from "./scoring";
import type { AssessmentResult } from "./types";

export type FeedbackPart = "COMMON" | "CAREER";
export interface StoredFeedback {
  part: FeedbackPart;
  body: Feedback;
  source: "AI" | "TEMPLATE";
}

const LEVEL = (n: number) => (n >= 75 ? "strong" : n >= 50 ? "solid" : "still building");

// ------------------------------------------------------------------------------------------------------------------
// facts handed to the model, and the template built from the same facts
// ------------------------------------------------------------------------------------------------------------------
export function commonFacts(bars: readonly SectionBar[]) {
  return { sections: bars.map((b) => ({ name: b.label, score: b.score, correct: b.correct, of: b.total })) };
}
export function careerFacts(r: AssessmentResult) {
  const compact = (s: SkillResult) => ({ skill: s.name, score: s.score, confidence: s.confidence, target: s.targetLevel });
  return {
    role: r.career?.name,
    elo: r.elo && { start: r.elo.startingElo, now: r.elo.newElo, correct: r.elo.correct, incorrect: r.elo.incorrect },
    readinessPercent: r.readiness,
    strongest: r.strongest.map(compact),
    focusAreas: r.focusAreas.map(compact),
    notEnoughEvidence: r.notYetMeasured.map((s) => s.name),
  };
}

export function templateCommon(bars: readonly SectionBar[]): Feedback {
  const scored = bars.filter((b) => b.score !== null).sort((a, b) => b.score! - a.score!);
  const top = scored[0];
  const low = scored[scored.length - 1];
  return {
    summary: top ? `Your ${top.label} result is ${LEVEL(top.score!)} (${top.score}/100). This common assessment is a baseline that sits beside your career results; it does not change your role rating.` : "Your common assessment is saved as a baseline for your profile.",
    strengths: top ? [`${top.label}: ${top.correct} of ${top.total} correct`] : ["You completed every section"],
    focusAreas: low && low !== top ? [`${low.label} is currently an area for development`] : ["Keep practising both areas to build a steadier baseline"],
    nextStep: low && low !== top ? `Spend 20 minutes this week on ${low.label.toLowerCase()} practice, then retake the section later to see the change.` : "Pick one small exercise in each area this week to keep the baseline moving.",
  };
}

export function templateCareer(r: AssessmentResult): Feedback {
  const strong = r.strongest[0];
  const focus = r.focusAreas[0];
  const name = r.career?.name ?? "your role";
  return {
    summary: `You finished the ${name} assessment with a rating of ${r.elo?.newElo ?? "—"} and ${r.readiness ?? 0}% career readiness. Skills with little evidence are marked as such rather than guessed.`,
    strengths: r.strongest.length ? r.strongest.slice(0, 3).map((s) => `${s.name}: ${s.score}/100 (${LEVEL(s.score ?? 0)})`) : ["You completed the full assessment"],
    focusAreas: r.focusAreas.length ? r.focusAreas.slice(0, 3).map((s) => developmentPhrase(s.name)) : ["Add proof of work or Arena results to measure the remaining skills"],
    nextStep: focus ? `Start with ${focus.name}: a short guided exercise this week is the quickest way to move your readiness.` : strong ? `Try an Arena challenge on ${strong.name} to push your rating higher.` : "Open your roadmap and pick the first step.",
  };
}

// ------------------------------------------------------------------------------------------------------------------
// generation + storage
// ------------------------------------------------------------------------------------------------------------------
const FEEDBACK_TIMEOUT_MS = 20_000;

async function aiFeedback(part: FeedbackPart, facts: unknown, deps: GenerateDeps) {
  const { system, user } = feedbackPrompt(part, facts);
  const call = generateStructured({ task: "feedback", system, user, schema: FeedbackSchema, temperature: 0.5, maxTokens: 700, promptVersion: FEEDBACK_PROMPT_VERSION }, { ...deps, attempts: deps.attempts ?? 2 });
  const out = await Promise.race([call, new Promise<never>((_, rej) => setTimeout(() => rej(new Error("feedback timed out")), FEEDBACK_TIMEOUT_MS))]);
  if (!feedbackToneOk(out.value)) throw new Error("feedback failed the tone check");
  return out;
}

/** Idempotent: parts that already exist are left alone. Never throws; a model failure stores the template instead. */
export async function generateFeedback(db: Db, userId: string, sessionId: string, result: AssessmentResult, opts: { deps?: GenerateDeps; templateOnly?: boolean } = {}): Promise<StoredFeedback[]> {
  const parts: { part: FeedbackPart; facts: unknown; template: Feedback }[] = [];
  if (result.general) parts.push({ part: "COMMON", facts: commonFacts(result.general), template: templateCommon(result.general) });
  if (result.layer === "CAREER") parts.push({ part: "CAREER", facts: careerFacts(result), template: templateCareer(result) });

  const { data: have } = await db.from("assessment_feedback").select("part").eq("session_id", sessionId);
  const done = new Set((have ?? []).map((h: { part: string }) => h.part));
  await Promise.all(
    parts.filter((p) => !done.has(p.part)).map(async (p) => {
      let row: { body: Feedback; source: "AI" | "TEMPLATE"; provider: string | null; model: string | null; prompt_version: string | null };
      try {
        if (opts.templateOnly) throw new Error("template requested");
        const out = await aiFeedback(p.part, p.facts, opts.deps ?? {});
        row = { body: out.value, source: "AI", provider: out.provider, model: out.model, prompt_version: out.promptVersion };
      } catch (e) {
        if (!opts.templateOnly) console.error(`[assess] ${p.part} feedback fell back to the template:`, (e as Error).message);
        row = { body: p.template, source: "TEMPLATE", provider: null, model: null, prompt_version: null };
      }
      const { error } = await db.from("assessment_feedback").upsert({ session_id: sessionId, student_id: userId, part: p.part, ...row }, { onConflict: "session_id,part", ignoreDuplicates: true });
      if (error) console.error("[assess] storing feedback failed:", error.message);
      else void track(db, userId, "feedback_generated", { sessionId, part: p.part, source: row.source });
    })
  );
  return readFeedback(db, sessionId);
}

export async function readFeedback(db: Db, sessionId: string): Promise<StoredFeedback[]> {
  const { data } = await db.from("assessment_feedback").select("part, body, source").eq("session_id", sessionId);
  return (data ?? []) as StoredFeedback[];
}

export { type SectionBar };
