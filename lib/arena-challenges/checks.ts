import { z } from "zod";
import { gradeSqlResult } from "@/lib/arena-workstations/engines/sql-grade";
import type { SqlResult } from "@/lib/arena-workstations/engines/sql-runner";
import type { CheckType, Verification } from "@/lib/arena-runtime/types";
import { parseNumericAnswer } from "./numeric-answer";

const MAX_FILES_BYTES = 200_000;
const answerValue = z.union([z.string().max(5000), z.number(), z.array(z.string().max(500)).max(50)]);

/** What a workstation hands the server on submit. Keyed by check id; only the fields a challenge's checks use need be present. */
export const SubmissionSchema = z
  .object({
    answers: z.record(z.string(), answerValue).default({}),
    queries: z.record(z.string(), z.string().max(5000)).default({}),
    terminal: z.record(z.string(), z.string().max(20_000)).default({}),
    files: z.record(z.string(), z.string()).default({}),
    /** results the student's browser claims (tests, DOM assertions). Self-attested, never trusted as verified. */
    reported: z.record(z.string(), z.boolean()).default({}),
  })
  .refine((s) => Object.values(s.files).reduce((n, f) => n + f.length, 0) <= MAX_FILES_BYTES, { message: "Submitted files are too large." });
export type Submission = z.infer<typeof SubmissionSchema>;

export interface CheckRow {
  id: string;
  stepId: string | null;
  checkType: CheckType;
  label: string;
  config: Record<string, unknown>;
  visible: boolean;
  weight: number;
  verification: Verification;
}

export type RunSql = (seedSql: string, queries: string[]) => Promise<SqlResult[]>;
export interface CheckContext {
  /** challenges.starter_assets_ref, e.g. { seedSql } */
  assets: Record<string, unknown> | null;
  runSql: RunSql;
}

const str = (v: unknown): string | null => (typeof v === "string" ? v : null);

/** The server can only re-evaluate what it computes itself; a check that rests on the browser's own claim is always CLIENT, whatever the row says. */
export function effectiveVerification(check: Pick<CheckRow, "checkType" | "verification" | "config">): Verification {
  if (check.checkType === "TEST_RUN" || check.checkType === "DOM_ASSERTION") return "CLIENT";
  if (check.checkType === "TERMINAL_OUTPUT" && !str(check.config.matches)) return "CLIENT";
  return check.verification;
}

const normalise = (s: string) => s.replace(/\r\n/g, "\n").trim();

function safeRegex(source: string): RegExp | null {
  try {
    return new RegExp(source, "m");
  } catch {
    return null;
  }
}

/** Evaluates one check deterministically. Never throws on bad student input; a malformed check (content bug) simply fails. */
export async function evaluateCheck(check: CheckRow, submission: Submission, ctx: CheckContext): Promise<boolean> {
  const { config } = check;
  switch (check.checkType) {
    case "NUMERIC_ANSWER": {
      const got = parseNumericAnswer(String(submission.answers[check.id] ?? ""));
      const want = typeof config.expected === "number" ? config.expected : parseNumericAnswer(String(config.expected ?? ""));
      if (got === null || want === null) return false;
      const tolerancePct = typeof config.tolerancePct === "number" ? config.tolerancePct : 1;
      return Math.abs(got - want) <= Math.max(1e-9, Math.abs(want) * (tolerancePct / 100));
    }
    case "CHOICE_ANSWER": {
      const given = [submission.answers[check.id]].flat().map((v) => String(v ?? "").trim()).filter(Boolean);
      const correct = [config.correct].flat().map((v) => String(v ?? "").trim()).filter(Boolean);
      return correct.length > 0 && given.length === correct.length && correct.every((c) => given.includes(c));
    }
    case "OUTPUT_MATCH": {
      const expected = str(config.expected);
      const got = submission.answers[check.id];
      return expected !== null && typeof got === "string" && normalise(got) === normalise(expected);
    }
    case "FILE_STATE": {
      const content = submission.files[str(config.path) ?? ""];
      if (content === undefined) return false;
      const contains = Array.isArray(config.contains) ? config.contains.filter((c): c is string => typeof c === "string") : [];
      const notContains = Array.isArray(config.notContains) ? config.notContains.filter((c): c is string => typeof c === "string") : [];
      const re = str(config.regex) ? safeRegex(str(config.regex)!) : null;
      if (str(config.regex) && !re) return false;
      return contains.every((c) => content.includes(c)) && notContains.every((c) => !content.includes(c)) && (re ? re.test(content) : true);
    }
    case "TERMINAL_OUTPUT": {
      const pattern = str(config.matches);
      if (!pattern) return submission.reported[check.id] === true;
      const re = safeRegex(pattern);
      return re !== null && re.test(submission.terminal[check.id] ?? "");
    }
    case "QUERY_RESULT": {
      const seed = str(config.seedSql) ?? str(ctx.assets?.seedSql);
      const truth = str(config.groundTruthQuery);
      const query = submission.queries[check.id];
      if (!seed || !truth || !query?.trim()) return false;
      const [expected, actual] = await ctx.runSql(seed, [truth, query]);
      if (!expected || !actual) return false;
      return gradeSqlResult(expected, actual).passed;
    }
    case "TEST_RUN":
    case "DOM_ASSERTION":
      return submission.reported[check.id] === true;
  }
}
