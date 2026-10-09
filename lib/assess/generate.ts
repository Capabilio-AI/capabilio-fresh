// Question generation: versioned prompt -> provider-neutral generateStructured -> strict validation -> independent verification ->
// stored once in the shared pool (deduped by content hash). Nothing here runs while a student waits on a specific question except
// the cold-start path in session.ts, which has a timeout and falls back to the stored pool.

import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { generateStructured, type GenerateDeps } from "@/lib/ai/llm";
import { QUESTION_PROMPT_VERSION, buildPrompt, type PromptContext } from "@/lib/ai/llm/prompts/question.v1";
import { GENERATION_BATCH_SIZE, QUESTION_VERSION, type Difficulty } from "./config";
import type { CareerSlot, GeneralSlot, Slot } from "./slots";
import { GeneratedBatchSchema, contentHash, validateQuestion, type ValidQuestion } from "./validate";

export type { CareerSlot, GeneralSlot, Slot, PromptContext };
export { buildPrompt };
export type LlmDeps = GenerateDeps;

export interface Provenance {
  provider: string;
  model: string;
  promptVersion: string;
}

const AnswersSchema = z.object({ answers: z.array(z.object({ id: z.number().int(), choice: z.string() })) });
const norm = (s: string) => s.trim().toLowerCase().replace(/\s+/g, " ");

/**
 * Second pass: a fresh call solves each question WITHOUT seeing the key. A question is kept only when the independent answer
 * matches the generated key, which filters out wrong keys and ambiguous questions. If the verifier itself fails, nothing from
 * the batch is stored (the pool just stays unfilled until the next top-up), never an unchecked question.
 */
export async function verifyBatch(questions: readonly ValidQuestion[], deps: LlmDeps = {}): Promise<{ kept: ValidQuestion[]; rejected: number }> {
  const out = await generateStructured(
    {
      task: "question_verify",
      system: `You are a careful expert answering multiple-choice questions. For each question choose the single best option.
Respond with ONE JSON object: {"answers":[{"id": number, "choice": "exact text of the option you chose"}]} and nothing else.`,
      user: JSON.stringify(questions.map((q, id) => ({ id, question: q.question, options: q.options }))),
      schema: AnswersSchema,
      temperature: 0,
      maxTokens: 1500,
      promptVersion: "question-verify.v1",
    },
    deps
  );
  const chosen = new Map(out.value.answers.map((a) => [a.id, norm(a.choice)]));
  const kept = questions.filter((q, id) => chosen.get(id) === norm(q.options[q.correctIndex]));
  return { kept, rejected: questions.length - kept.length };
}

export interface BatchResult {
  valid: ValidQuestion[];
  rejected: string[];
  provenance: Provenance | null;
}

/** One generation call. Schema failures and semantic failures are rejected individually, never shown or stored. */
export async function generateBatch(ctx: PromptContext, deps: LlmDeps = {}): Promise<BatchResult> {
  const { system, user, expectation } = buildPrompt(ctx);
  const gen = await generateStructured({ task: "question", system, user, schema: GeneratedBatchSchema, maxTokens: 3800, promptVersion: QUESTION_PROMPT_VERSION }, deps);
  const provenance: Provenance = { provider: gen.provider, model: gen.model, promptVersion: gen.promptVersion };

  const valid: ValidQuestion[] = [];
  const rejected: string[] = [];
  const seen = new Set<string>();
  for (const raw of gen.value.questions) {
    const verdict = validateQuestion(raw, expectation);
    if (!verdict.ok) {
      rejected.push(verdict.reason);
      continue;
    }
    const h = contentHash(verdict.question.question, expectation.skillKey);
    if (seen.has(h)) {
      rejected.push("duplicate within batch");
      continue;
    }
    seen.add(h);
    valid.push(verdict.question);
  }
  if (valid.length === 0) return { valid, rejected, provenance };
  const checked = await verifyBatch(valid, deps);
  if (checked.rejected > 0) rejected.push(`${checked.rejected} failed independent answer verification`);
  return { valid: checked.kept, rejected, provenance };
}

// ------------------------------------------------------------------------------------------------------------------
// storage
// ------------------------------------------------------------------------------------------------------------------

/** Inserts validated questions; a stem already in the pool (same content hash) is skipped, so students share one pool. */
export async function storeQuestions(db: SupabaseClient, slot: Slot, questions: readonly ValidQuestion[], by: Provenance): Promise<number> {
  if (questions.length === 0) return 0;
  const rows = questions.map((q) => ({
    layer: slot.kind,
    section: slot.kind === "GENERAL" ? slot.section : null,
    career_id: slot.kind === "CAREER" ? slot.careerId : null,
    skill_id: slot.kind === "CAREER" ? slot.skillId : null,
    skill_name: slot.kind === "CAREER" ? slot.skillName : q.skill,
    category: slot.kind === "CAREER" ? slot.category : slot.label,
    difficulty: q.difficulty,
    question_type: q.type,
    question_text: q.question,
    options: q.options,
    correct_index: q.correctIndex,
    explanation: q.explanation,
    estimated_seconds: q.estimatedTimeSeconds,
    source: "groq",
    provider: by.provider,
    model: by.model,
    prompt_version: by.promptVersion,
    version: QUESTION_VERSION,
    content_hash: contentHash(q.question, slot.kind === "CAREER" ? slot.skillKey : slot.section),
  }));
  const { data, error } = await db.from("assess_question_pool").upsert(rows, { onConflict: "content_hash", ignoreDuplicates: true }).select("id");
  if (error) throw error;
  return data?.length ?? 0;
}

/** Existing stems for a slot, handed to the model so it does not regenerate them. */
export async function recentStems(db: SupabaseClient, slot: Slot, limit = 6): Promise<string[]> {
  let q = db.from("assess_question_pool").select("question_text").eq("is_active", true).order("created_at", { ascending: false }).limit(limit);
  q = slot.kind === "CAREER" ? q.eq("career_id", slot.careerId).eq("skill_id", slot.skillId) : q.eq("layer", "GENERAL").eq("section", slot.section);
  const { data } = await q;
  return (data ?? []).map((r: { question_text: string }) => r.question_text.slice(0, 110));
}

export interface TopUpResult {
  inserted: number;
  rejected: string[];
}

/**
 * Generates until `want` NEW questions are stored for (slot, difficulty) or `rounds` is used up. Invalid output is
 * regenerated, never repaired or shown.
 */
export async function topUp(
  db: SupabaseClient,
  slot: Slot,
  difficulty: Difficulty,
  want: number,
  opts: { studentLevel?: string; rounds?: number; deps?: LlmDeps; context?: Pick<PromptContext, "assessed" | "remaining"> } = {}
): Promise<TopUpResult> {
  let inserted = 0;
  const rejected: string[] = [];
  for (let round = 0; round < (opts.rounds ?? 3) && inserted < want; round++) {
    const avoid = await recentStems(db, slot);
    const out = await generateBatch(
      { slot, difficulty, count: Math.min(GENERATION_BATCH_SIZE, want - inserted + 1), studentLevel: opts.studentLevel ?? "final-year engineering student or fresher", avoid, ...opts.context },
      opts.deps
    );
    rejected.push(...out.rejected);
    if (out.valid.length > 0 && out.provenance) inserted += await storeQuestions(db, slot, out.valid, out.provenance);
  }
  return { inserted, rejected };
}
