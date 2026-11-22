import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import type { PublicProblem } from "@/lib/arena-challenges/leetcode/problem";
import { assessmentPool, gradeAssessment, isProven, pickAssessment, reviewAssessment, type ModuleProofRow } from "./module-gate";
import type { HtmlChallenge, ModuleChallenge, SqlChallenge, Track, TrackModule } from "./types";
import type { Dataset } from "@/lib/arena-workstations/engines/dataset";

type Service = SupabaseClient;
type Raw = { module_key: string; assessment_attempts: number; assessment_passed_at: string | null; problem_attempts: number; problem_passed_at: string | null; proven_at: string | null };
const COLUMNS = "module_key, assessment_attempts, assessment_passed_at, problem_attempts, problem_passed_at, proven_at";
const toRow = (r: Raw): ModuleProofRow => ({ assessmentAttempts: r.assessment_attempts, assessmentPassedAt: r.assessment_passed_at, problemAttempts: r.problem_attempts, problemPassedAt: r.problem_passed_at, provenAt: r.proven_at });
export const emptyProof = (): ModuleProofRow => ({ assessmentAttempts: 0, assessmentPassedAt: null, problemAttempts: 0, problemPassedAt: null, provenAt: null });

/** The student's proof state for each module of a track, keyed by module. A table that cannot be read throws: it must never look like "nothing proven". */
export async function loadModuleProofs(service: Service, userId: string, trackKey: string): Promise<Record<string, ModuleProofRow>> {
  const { data, error } = await untyped(service).from("language_module_proof").select(COLUMNS).eq("user_id", userId).eq("track", trackKey);
  if (error) throw new Error(`could not read module proof: ${error.message}`);
  return Object.fromEntries(((data ?? []) as Raw[]).map((r) => [r.module_key, toRow(r)]));
}

/** Another submission for the same module was saved after this one was read: nothing was written, and the student can try again. */
export class ProofConflict extends Error {
  constructor() { super("another submission for this module was saved at the same moment"); this.name = "ProofConflict"; }
}

/**
 * Writes the new state only if the row is still the one that was read. Without that, requests made at the same moment all grade against the same
 * attempt and the last write wins: a pass could be wiped, or many guesses at the same questions could be tried at once. A row exists once either
 * counter has moved (every save moves one), so an empty previous state means "insert" and anything else means "update where the counters are unchanged".
 */
async function save(service: Service, userId: string, track: Track, m: TrackModule, previous: ModuleProofRow, next: ModuleProofRow): Promise<ModuleProofRow> {
  const provenAt = next.provenAt ?? (isProven(track, m, next) ? new Date().toISOString() : null);
  const fields = {
    assessment_attempts: next.assessmentAttempts, assessment_passed_at: next.assessmentPassedAt,
    problem_attempts: next.problemAttempts, problem_passed_at: next.problemPassedAt, proven_at: provenAt, updated_at: new Date().toISOString(),
  };
  const table = untyped(service).from("language_module_proof");
  if (previous.assessmentAttempts + previous.problemAttempts === 0) {
    const { error } = await table.insert({ user_id: userId, track: track.key, module_key: m.key, ...fields });
    if (error?.code === "23505") throw new ProofConflict();
    if (error) throw new Error(`could not save module proof: ${error.message}`);
  } else {
    const { data, error } = await table.update(fields).eq("user_id", userId).eq("track", track.key).eq("module_key", m.key)
      .eq("assessment_attempts", previous.assessmentAttempts).eq("problem_attempts", previous.problemAttempts).select("module_key");
    if (error) throw new Error(`could not save module proof: ${error.message}`);
    if (!data || data.length === 0) throw new ProofConflict();
  }
  return { ...next, provenAt };
}

/** The questions of the student's current assessment attempt, answers withheld by the caller. */
export const currentAssessment = (m: TrackModule, userId: string, row: ModuleProofRow) => pickAssessment(assessmentPool(m), userId, m.key, row.assessmentAttempts + 1);

/** Marks the current attempt. A pass stays a pass; a miss counts the attempt, so the next one draws different questions. */
export async function submitAssessment(service: Service, userId: string, track: Track, m: TrackModule, row: ModuleProofRow, answers: Record<string, number>) {
  const asked = currentAssessment(m, userId, row);
  const graded = gradeAssessment(asked, answers);
  const saved = await save(service, userId, track, m, row, { ...row, assessmentAttempts: row.assessmentAttempts + 1, assessmentPassedAt: row.assessmentPassedAt ?? (graded.passed ? new Date().toISOString() : null) });
  // a pass needs no review; a miss shows what each missed question was and why, so the next try is informed
  return { ...graded, review: graded.passed ? [] : reviewAssessment(asked, answers), state: saved };
}

/** Records a judged attempt at the module's problem; a pass stays a pass. */
export async function recordProblem(service: Service, userId: string, track: Track, m: TrackModule, row: ModuleProofRow, passed: boolean): Promise<ModuleProofRow> {
  return save(service, userId, track, m, row, { ...row, problemAttempts: row.problemAttempts + 1, problemPassedAt: row.problemPassedAt ?? (passed ? new Date().toISOString() : null) });
}

const C_STARTER = '#include <stdio.h>\n\nint main(void) {\n    // Read the input as described, print the answer exactly as the output format says.\n    return 0;\n}\n';
const PY_STARTER = "# Read the input as described, then print the answer exactly as the output format says.\n";

/** What a student may see of a module problem: the statement and its examples, never the hidden tests or the reference. */
export function publicChallenge(c: ModuleChallenge): PublicProblem {
  return {
    statement: c.statement, inputFormat: c.inputFormat, outputFormat: c.outputFormat, constraints: c.constraints,
    examples: c.tests.slice(0, c.exampleCount).map((t, i) => ({ input: t.input.trimEnd(), output: t.output.trimEnd(), explanation: c.explanations[i] ?? "" })),
    starters: { python: PY_STARTER, c: C_STARTER },
  };
}

/** What a student may see of a SQL problem: the statement, the visible tables and a starter; never the reference, the probes or the hidden data. */
export function publicSqlChallenge(c: SqlChallenge): { kind: "sql"; title: string; statement: string; mode: "query" | "script"; tables: Dataset[]; starter: string; ordered: boolean } {
  return { kind: "sql", title: c.title, statement: c.statement, mode: c.mode, tables: c.datasets[0], starter: c.starter, ordered: c.ordered };
}

/** What a student may see of a page problem: the statement, the starter and the requirements in words; never the checks that decide them. */
export function publicHtmlChallenge(c: HtmlChallenge): { kind: "html"; title: string; statement: string; starter: string; requirements: string[] } {
  return { kind: "html", title: c.title, statement: c.statement, starter: c.starter, requirements: c.requirements.map((r) => r.text) };
}
