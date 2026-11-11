import { z } from "zod";
import { createHash } from "node:crypto";
import type { ImportedQuestion } from "./aqua";

/** Questions written by a model for Capabilio, then independently checked by a second call. They are original, so there is no third-party licence. */
export const GENERATED_SOURCE = { source: "ai-generated", license: "original" } as const;

export const SOFT_TOPICS = ["Teamwork", "Conflict", "Leadership", "Communication", "Time Management", "Ownership", "Feedback", "Professional Conduct", "Adaptability", "Stress", "Ethics", "Customer Focus", "Networking", "Interview Etiquette", "Group Discussion", "Work-Life Balance"] as const;
export const VERBAL_TOPICS = ["Grammar", "Vocabulary", "Sentence Correction", "Workplace Writing", "Idioms & Phrases", "Spoken Communication"] as const;

const KEYS = ["a", "b", "c", "d"] as const;
const text = z.string().trim().min(3).max(300);

export const SoftBatch = z.object({ items: z.array(z.object({ situation: z.string().trim().min(25).max(400), responses: z.array(text).length(4), why: z.string().trim().min(15).max(400) })).min(1) });
export const VerbalBatch = z.object({ items: z.array(z.object({ question: z.string().trim().min(12).max(400), options: z.array(text).length(4), correct: z.number().int().min(0).max(3), why: z.string().trim().min(10).max(400) })).min(1) });
export const RankAnswer = z.object({ answers: z.array(z.object({ id: z.number().int(), best: z.number().int().min(0).max(3), worst: z.number().int().min(0).max(3) })) });
export const PickAnswer = z.object({ answers: z.array(z.object({ id: z.number().int(), choice: z.number().int().min(0).max(3) })) });

const norm = (s: string) => s.toLowerCase().replace(/\s+/g, " ").trim();
export const hashOf = (prompt: string, options: readonly string[]) => createHash("sha256").update(`${norm(prompt)}|${options.map(norm).join("|")}`).digest("hex");

/** Pure. A generated scenario is usable only if its four responses differ and none of them is a lazy catch-all. */
export function soundResponses(rs: readonly string[]): boolean {
  return new Set(rs.map(norm)).size === 4 && !rs.some((r) => /\b(all|none) of the above\b/i.test(r));
}

/** Pure. Best-first responses as a 3/2/1/0 question with the options shuffled by `order` (a permutation of 0-3). Returns the shuffle so a verifier can be shown the same order. */
export function softQuestion(topic: string, item: { situation: string; responses: readonly string[]; why: string }, order: readonly number[]): ImportedQuestion {
  return {
    topic,
    difficulty: 2,
    prompt: `${item.situation.replace(/\s+/g, " ").trim()} What would you do?`,
    options: order.map((original, i) => ({ key: KEYS[i], text: item.responses[original], points: 3 - original })),
    explanation: item.why,
  };
}

/** Pure. The model keeps a scenario only if an independent reader also picks the intended best response and the intended worst one. `order[i]` = original index shown at position i. */
export function rankingAgrees(answer: { best: number; worst: number }, order: readonly number[]): boolean {
  return order[answer.best] === 0 && order[answer.worst] === 3;
}

/** Pure. A right/wrong question with its options in the order given, 1 point for the correct one. */
export function verbalQuestion(topic: string, item: { question: string; options: readonly string[]; correct: number; why: string }, order: readonly number[]): ImportedQuestion | null {
  if (new Set(item.options.map(norm)).size !== 4) return null;
  return {
    topic,
    difficulty: 1,
    prompt: item.question.replace(/\s+/g, " ").trim(),
    options: order.map((original, i) => ({ key: KEYS[i], text: item.options[original], points: original === item.correct ? 1 : 0 })),
    explanation: item.why,
  };
}
