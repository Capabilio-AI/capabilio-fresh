import { createHash } from "node:crypto";

/** Where the questions come from, kept with each one so the source and its licence travel with it. */
export const AQUA_SOURCE = { source: "aqua-rat", license: "Apache-2.0", ref: "https://huggingface.co/datasets/deepmind/aqua_rat", attribution: "AQuA-RAT, DeepMind (Apache License 2.0)" } as const;

export interface ImportedQuestion {
  topic: string;
  difficulty: 1 | 2 | 3;
  prompt: string;
  options: { key: string; text: string; points: number }[];
  explanation: string;
}
export type Parsed = { ok: true; question: ImportedQuestion } | { ok: false; reason: string };

const KEYS = ["a", "b", "c", "d", "e"] as const;
const NEEDS_PICTURE = /\b(figure|diagram|graph|shown|chart|table below|picture|image)\b/i;

/** Pure. The CRT aptitude topic a word problem is about, by the words it uses; anything else is "Algebra & Numbers". */
export function classifyTopic(prompt: string): string {
  const t = prompt.toLowerCase();
  if (/\b(profit|loss|discount|cost price|selling price|marked price|gain)\b/.test(t)) return "Profit & Loss";
  if (/\b(simple interest|compound interest|per annum|interest|rate of interest)\b/.test(t)) return "Simple & Compound Interest";
  if (/\b(pipe|tank|cistern|work|workers|job|complete the work|days to)\b/.test(t)) return "Time & Work";
  if (/\b(km\/h|kmph|speed|train|distance|mph|m\/s|metres per second|travels)\b/.test(t)) return "Time, Speed & Distance";
  if (/\b(ratio|proportion|in the ratio)\b|\d+\s*:\s*\d+/.test(t)) return "Ratio & Proportion";
  if (/\b(average|mean)\b/.test(t)) return "Averages";
  if (/\b(probability|permutation|combination|arranged|in how many ways|ways can|selected|chosen)\b/.test(t)) return "Permutation & Probability";
  if (/%|percent/.test(t)) return "Percentages";
  return "Algebra & Numbers";
}

/** Pure. How hard a worked solution looks: the number of steps it takes. */
export function difficultyOf(rationale: string): 1 | 2 | 3 {
  const lines = rationale.split("\n").map((l) => l.trim()).filter(Boolean).length;
  return lines <= 4 ? 1 : lines <= 8 ? 2 : 3;
}

/** Pure. A stable fingerprint of a question and its options, so the same question is never stored twice. */
export function questionHash(prompt: string, options: readonly string[]): string {
  const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
  return createHash("sha256").update(`${norm(prompt)}|${options.map(norm).join("|")}`).digest("hex");
}

const escapeRe = (t: string) => t.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
const hasWord = (line: string, text: string) => new RegExp(`(^|[^\\w.])${escapeRe(text)}($|[^\\w])`, "i").test(line);

/**
 * Pure. Whether the worked solution agrees with the marked option. If it states a letter ("The answer is B"), that letter decides. Otherwise its
 * last line must contain the marked option's own value and no other option's. "no" = it names another answer, "unclear" = it confirms nothing.
 */
export function confirms(rationale: string, optionTexts: readonly string[], correctIndex: number): "yes" | "no" | "unclear" {
  const stated = [...rationale.matchAll(/(?:correct\s+)?(?:answer|option|choice)\s*(?:is|:)?\s*\(?\s*([A-E])\b/gi)].map((m) => m[1].toUpperCase()).pop();
  if (stated) return stated === "ABCDE"[correctIndex] ? "yes" : "no";
  const last = rationale.trim().split("\n").map((l) => l.trim()).filter(Boolean).pop() ?? "";
  const mine = hasWord(last, optionTexts[correctIndex]);
  const others = optionTexts.some((t, i) => i !== correctIndex && hasWord(last, t));
  return mine && !others ? "yes" : others && !mine ? "no" : "unclear";
}

/**
 * Pure. One AQuA-RAT row as a CRT question, or the reason it was left out. The dataset is human-written and carries some label noise, so a row
 * is kept only when its own worked solution confirms the answer that is marked correct, it has five distinct options, it does not depend on a picture,
 * and it is a sensible length.
 */
export function parseAquaRow(row: unknown): Parsed {
  const r = row as { question?: unknown; options?: unknown; rationale?: unknown; correct?: unknown } | null;
  if (!r || typeof r.question !== "string" || !Array.isArray(r.options) || typeof r.rationale !== "string" || typeof r.correct !== "string") return { ok: false, reason: "not a question row" };
  const prompt = r.question.replace(/\s+/g, " ").trim();
  if (prompt.length < 20 || prompt.length > 600) return { ok: false, reason: "too short or too long" };
  if (NEEDS_PICTURE.test(prompt)) return { ok: false, reason: "needs a picture" };
  if (r.options.length !== 5 || r.options.some((o) => typeof o !== "string")) return { ok: false, reason: "not five options" };
  const texts = (r.options as string[]).map((o) => o.replace(/^\s*[A-Ea-e]\s*[).:]\s*/, "").trim());
  if (texts.some((t) => t.length === 0 || t.length > 120) || new Set(texts.map((t) => t.toLowerCase())).size !== 5) return { ok: false, reason: "options empty, long or repeated" };
  const correct = r.correct.trim().toUpperCase();
  const index = "ABCDE".indexOf(correct);
  if (correct.length !== 1 || index < 0) return { ok: false, reason: "no valid marked answer" };
  const verdict = confirms(r.rationale, texts, index);
  if (verdict !== "yes") return { ok: false, reason: verdict === "no" ? "worked answer disagrees with the marked answer" : "worked solution does not confirm the marked answer" };
  const rationale = r.rationale.trim();
  return {
    ok: true,
    question: {
      topic: classifyTopic(prompt),
      difficulty: difficultyOf(rationale),
      prompt,
      options: texts.map((text, i) => ({ key: KEYS[i], text, points: i === index ? 1 : 0 })),
      explanation: rationale.slice(0, 1200),
    },
  };
}
