import { forStage, type SessionEvent } from "./events";

export const DIMENSIONS = ["analysis", "discovery", "planning", "judgement", "execution", "aiCollaboration"] as const;
export type Dimension = (typeof DIMENSIONS)[number];

/** level 0-3, or null when there is nothing to assess (AI not used is never a penalty). `trusted` is false when the signal rests on client-reported events. */
export interface DimensionSignal {
  level: 0 | 1 | 2 | 3 | null;
  basis: string;
  trusted: boolean;
  /** seq numbers of the events that justify the level, so the report can show its evidence */
  evidence: number[];
}

const MIN_PLAN_WORDS = 8;
const MIN_PROMPT_CHARS = 60;

const firstSeq = (events: SessionEvent[], pred: (e: SessionEvent) => boolean) => events.find(pred)?.seq ?? Infinity;
const level = (n: number): 0 | 1 | 2 | 3 => (n <= 0 ? 0 : n >= 3 ? 3 : (n as 1 | 2));

/** Analysis: understood the task and looked at the data before acting. Client-reported, so lower trust. */
function analysis(stage: SessionEvent[]): DimensionSignal {
  const firstAct = Math.min(firstSeq(stage, (e) => e.kind === "query_run"), firstSeq(stage, (e) => e.kind === "submitted"));
  const brief = stage.find((e) => e.kind === "brief_viewed" && e.seq < firstAct);
  const inspected = new Set(stage.filter((e) => e.kind === "data_inspected" && e.seq < firstAct).map((e) => (e as { target: string }).target));
  const evidence = [brief?.seq, ...stage.filter((e) => e.kind === "data_inspected" && e.seq < firstAct).map((e) => e.seq)].filter((s): s is number => s !== undefined);
  const n = (brief ? 1 : 0) + (inspected.size >= 1 ? 1 : 0) + (inspected.size >= 2 ? 1 : 0);
  return { level: level(n), trusted: false, evidence, basis: `${brief ? "read the brief" : "did not open the brief"} and looked at ${inspected.size} data source(s) before acting` };
}

/** Discovery: how many different things were explored (distinct data sources and distinct queries), each counted once so repetition earns nothing. */
function discovery(stage: SessionEvent[]): DimensionSignal {
  const firstCheck = firstSeq(stage, (e) => e.kind === "check_run");
  const targets = new Set(stage.filter((e) => e.kind === "data_inspected").map((e) => (e as { target: string }).target));
  const queries = new Map<string, number>();
  for (const e of stage) if (e.kind === "query_run" && e.ok && e.seq < firstCheck && !queries.has(e.sqlHash)) queries.set(e.sqlHash, e.seq);
  const distinct = targets.size + queries.size;
  const n = distinct === 0 ? 0 : distinct === 1 ? 1 : distinct <= 3 ? 2 : 3;
  return { level: level(n), trusted: false, evidence: [...queries.values()], basis: `${targets.size} data source(s) inspected and ${queries.size} different working query(ies) before the first check` };
}

/** Planning: wrote a real plan (at least a sentence) before running anything. */
function planning(stage: SessionEvent[]): DimensionSignal {
  const notes = stage.filter((e): e is Extract<SessionEvent, { kind: "plan_note" }> => e.kind === "plan_note" && e.words >= MIN_PLAN_WORDS);
  const firstQuery = firstSeq(stage, (e) => e.kind === "query_run");
  const before = notes.find((n) => n.seq < firstQuery);
  const any = notes[0];
  return { level: before ? 3 : any ? 2 : 0, trusted: true, evidence: (before ?? any) ? [(before ?? any)!.seq] : [], basis: before ? "wrote a plan before running anything" : any ? "wrote a plan after starting" : `no plan note of at least ${MIN_PLAN_WORDS} words` };
}

/** Judgement: checked the work before submitting, and acted on a failure. */
function judgement(stage: SessionEvent[]): DimensionSignal {
  const checks = stage.filter((e): e is Extract<SessionEvent, { kind: "check_run" }> => e.kind === "check_run");
  const submit = stage.find((e) => e.kind === "submitted");
  if (checks.length === 0) return { level: submit ? 0 : null, trusted: true, evidence: submit ? [submit.seq] : [], basis: submit ? "submitted without running the checks" : "nothing submitted yet" };
  const failedAt = checks.find((c) => c.passed < c.total);
  const acted = failedAt ? stage.some((e) => e.seq > failedAt.seq && (e.kind === "query_run" || e.kind === "plan_note")) : false;
  const last = checks[checks.length - 1];
  const endedPassing = last.passed === last.total;
  const n = 1 + (failedAt ? (acted ? 1 : 0) : 1) + (failedAt && acted && endedPassing ? 1 : 0);
  return { level: level(n), trusted: true, evidence: checks.map((c) => c.seq), basis: failedAt ? (acted && endedPassing ? "a check failed, they changed their work and it then passed" : acted ? "a check failed and they changed their work" : "a check failed and they did not change their work") : "ran the checks and they passed first time" };
}

/** AI collaboration: gave useful context, and verified what the assistant said instead of trusting it. null when AI was not used. */
function aiCollaboration(stage: SessionEvent[]): DimensionSignal {
  const prompts = stage.filter((e): e is Extract<SessionEvent, { kind: "ai_prompt" }> => e.kind === "ai_prompt");
  if (prompts.length === 0) return { level: null, trusted: true, evidence: [], basis: "the AI assistant was not used" };
  const replies = stage.filter((e) => e.kind === "ai_reply");
  let verified = 0;
  for (const r of replies) {
    const next = stage.find((e) => e.seq > r.seq && (e.kind === "ai_prompt" || e.kind === "submitted" || e.kind === "check_run" || e.kind === "query_run"));
    if (next && (next.kind === "check_run" || next.kind === "query_run")) verified += 1;
  }
  const withContext = prompts.filter((p) => p.chars >= MIN_PROMPT_CHARS).length;
  const n = 1 + (verified > 0 ? 1 : 0) + (verified >= replies.length && withContext >= Math.ceil(prompts.length / 2) ? 1 : 0);
  return { level: level(n), trusted: true, evidence: prompts.map((p) => p.seq), basis: `${prompts.length} question(s), ${withContext} with real context; ${verified} of ${replies.length} answer(s) tested before moving on` };
}

/** Execution comes from server-run check outcomes, never from the log. */
export function executionSignal(stagesPassed: number, stagesTotal: number): DimensionSignal {
  const n = stagesTotal === 0 || stagesPassed === 0 ? 0 : stagesPassed >= stagesTotal ? 3 : stagesPassed / stagesTotal >= 0.5 ? 2 : 1;
  return { level: level(n), trusted: true, evidence: [], basis: `${stagesPassed} of ${stagesTotal} stage(s) passed their checks` };
}

const worst = (a: DimensionSignal["level"], b: DimensionSignal["level"]) => (a === null ? b : b === null ? a : (Math.min(a, b) as 0 | 1 | 2 | 3));

/** Pure. Merges per-stage signals into one: the lowest level across stages, because a skill shown once and skipped elsewhere is not a habit. */
const merge = (signals: DimensionSignal[]): DimensionSignal => {
  const assessed = signals.filter((s) => s.level !== null);
  if (assessed.length === 0) return { ...signals[0], level: null };
  return { level: assessed.map((s) => s.level).reduce((a, b) => worst(a, b)), trusted: signals.every((s) => s.trusted), evidence: signals.flatMap((s) => s.evidence), basis: assessed.map((s) => s.basis).join("; ") };
};

export function assessSession(events: readonly SessionEvent[], stageKeys: readonly string[], stagesPassed: number): Record<Dimension, DimensionSignal> {
  const per = stageKeys.map((k) => forStage(events, k)).filter((s) => s.length > 0);
  const over = (f: (s: SessionEvent[]) => DimensionSignal): DimensionSignal => (per.length === 0 ? { level: null, trusted: true, evidence: [], basis: "no activity was recorded" } : merge(per.map(f)));
  return {
    analysis: over(analysis),
    discovery: over(discovery),
    planning: over(planning),
    judgement: over(judgement),
    execution: executionSignal(stagesPassed, stageKeys.length),
    aiCollaboration: over(aiCollaboration),
  };
}
