import { gradeSqlResult } from "@/lib/arena-workstations/engines/sql-grade";
import type { SqlResult } from "@/lib/arena-workstations/engines/sql-runner";
import { buildSeedSql, type Dialect } from "@/lib/arena-workstations/engines/seed-sql";
import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { Difficulty } from "@/lib/arena-workstations/types";
import { LEVELS, levelAtLeast, type ExperienceLevel } from "../level";
import type { Rng } from "../rng";
import type { ScriptRun } from "../sql/local-runner";
import type { QueryDraft, ScriptDraft, TaskKind, TicketDraft, TicketTemplate } from "./types";

export type RunSql = (seedSql: string, queries: string[]) => Promise<SqlResult[]>;
export type RunScript = (seedSql: string, script: string, probes: string[]) => Promise<ScriptRun>;
export interface Runners {
  query: RunSql;
  script: RunScript;
}

type Table = Extract<SqlResult, { rows: unknown[][] }>;
export type Validation = { ok: true; expected: Table[] } | { ok: false; reason: string };

const MAX_RESULT_ROWS = 20;
const isTable = (r: SqlResult | undefined): r is Table => !!r && !("error" in r);

async function validateQuery(draft: QueryDraft, seedSql: string, run: RunSql): Promise<Validation> {
  const queries = [draft.referenceQuery, draft.mistakeQuery, ...(draft.tieGuard ? [draft.tieGuard.query] : [])];
  const [expected, mistake, ranking] = await run(seedSql, queries);
  if (!isTable(expected)) return { ok: false, reason: `reference failed: ${(expected as { error: string }).error}` };
  if (expected.rows.length < 1 || expected.rows.length > MAX_RESULT_ROWS) return { ok: false, reason: `reference returned ${expected.rows.length} rows` };
  if (!expected.rows.flat().some((v) => typeof v === "number")) return { ok: false, reason: "reference has no number" };
  // a debugging ticket may start from a query that fails outright; for any other ticket the classic mistake must at least run
  if (!isTable(mistake)) {
    if (!draft.starterQuery) return { ok: false, reason: "mistake query failed to run" };
  } else if (gradeSqlResult(expected, mistake).passed) return { ok: false, reason: draft.starterQuery ? "the broken query already gives the right answer" : "the common mistake gives the same answer" };
  if (draft.tieGuard) {
    if (!isTable(ranking)) return { ok: false, reason: "tie check failed to run" };
    const { n, metricColumn } = draft.tieGuard;
    if (ranking.rows.length > n && ranking.rows[n - 1][metricColumn] === ranking.rows[n][metricColumn]) return { ok: false, reason: "tie at the cut-off" };
  }
  return { ok: true, expected: [expected] };
}

/** The probe results a script leaves behind, for the probes that are graded. */
function comparedProbes(draft: ScriptDraft, run: ScriptRun): SqlResult[] | null {
  if (run.scriptError || run.probes.length !== draft.probes.length) return null;
  return draft.probes.flatMap((p, i) => (p.compare ? [run.probes[i]] : []));
}

/** True when every graded probe of `actual` matches `expected`. */
export function sameState(expected: SqlResult[], actual: SqlResult[] | null): boolean {
  return !!actual && expected.every((e, i) => gradeSqlResult(e, actual[i]).passed);
}

async function validateScript(draft: ScriptDraft, seedSql: string, run: RunScript): Promise<Validation> {
  const sqls = draft.probes.map((p) => p.sql);
  const [reference, mistake, doNothing] = await Promise.all([run(seedSql, draft.referenceScript, sqls), run(seedSql, draft.mistakeScript, sqls), run(seedSql, "", sqls)]);
  if (reference.scriptError) return { ok: false, reason: `reference script failed: ${reference.scriptError}` };
  const expected = comparedProbes(draft, reference);
  if (!expected || expected.length === 0) return { ok: false, reason: "no graded probe" };
  const bad = expected.find((e) => !isTable(e) || e.rows.length < 1 || e.rows.length > MAX_RESULT_ROWS);
  if (bad) return { ok: false, reason: "a graded probe errored or returned no/too many rows" };
  if (sameState(expected, comparedProbes(draft, doNothing))) return { ok: false, reason: "doing nothing already passes" };
  if (sameState(expected, comparedProbes(draft, mistake))) return { ok: false, reason: "the common mistake leaves the same state" };
  return { ok: true, expected: expected as Table[] };
}

/** What a ticket's database is made of: the warehouse plus any extra tables, and the setup SQL (constraints, derived tables, roles). */
export interface SeedParts {
  tables: Dataset[];
  setupSql: string;
}

export function seedParts(tables: Dataset[], draft: TicketDraft, worldSetupSql = ""): SeedParts {
  const script = draft.kind === "script" ? draft : null;
  return { tables: [...tables, ...(script?.extraTables ?? [])], setupSql: [worldSetupSql, script?.extraSetupSql ?? ""].filter(Boolean).join("\n") };
}

/** The full seed script, exactly as grading rebuilds it from the stored content. */
export const seedText = ({ tables, setupSql }: SeedParts, dialect: Dialect): string => [buildSeedSql(tables, dialect), setupSql].filter(Boolean).join("\n");

/**
 * A ticket is only served if its own queries prove it is fair: the reference runs, the answer is small, the classic mistake (and
 * doing nothing) gives a different answer, and a "top N" has no tie at the cut-off.
 */
export async function validateDraft(draft: TicketDraft, tables: Dataset[], runners: Runners, db: { dialect?: Dialect; setupSql?: string } = {}): Promise<Validation> {
  const seedSql = seedText(seedParts(tables, draft, db.setupSql), db.dialect ?? "sqlite");
  return draft.kind === "query" ? validateQuery(draft, seedSql, runners.query) : validateScript(draft, seedSql, runners.script);
}

export interface PickInput {
  templates: readonly TicketTemplate[];
  difficulty: Difficulty;
  level: ExperienceLevel;
  rng: Rng;
  avoidTitles: readonly string[];
  /** the kinds of the user's last tickets; a different kind is preferred so tasks are not all alike */
  recentKinds?: readonly TaskKind[];
  tables: Dataset[];
  runners: Runners;
  dialect?: Dialect;
  /** constraints and other setup every ticket of this world starts from */
  setupSql?: string;
  /** the skill area being served; only tickets that belong to it are considered */
  areaKey?: string;
  /** how many drafts to try before giving up */
  tries?: number;
}

export type Picked = { draft: TicketDraft; expected: Table[] };

/**
 * The templates to draw from, best fit first. A skill area with only a few tickets must still always serve something, so when nothing
 * matches the user's difficulty and level the search widens: first any difficulty for the level, then any level for the area (the
 * least demanding first). Every list holds only templates of the requested area.
 */
export function templateTiers<T extends { difficulty: Difficulty; minLevel: ExperienceLevel; areas?: string[] }>(templates: readonly T[], { difficulty, level, areaKey }: { difficulty: Difficulty; level: ExperienceLevel; areaKey: string }): T[][] {
  const inArea = templates.filter((t) => (t.areas ?? ["sql"]).includes(areaKey));
  const forLevel = inArea.filter((t) => levelAtLeast(level, t.minLevel));
  const byLevel = [...inArea].sort((a, b) => levelRank(a.minLevel) - levelRank(b.minLevel));
  const tiers = [forLevel.filter((t) => t.difficulty === difficulty), forLevel, byLevel];
  // each list contains the one before it, so a list of the same size adds nothing
  return tiers.filter((tier, i) => tier.length > 0 && (i === 0 || tier.length > tiers[i - 1].length));
}
const levelRank = (l: ExperienceLevel) => LEVELS.indexOf(l);

/**
 * First valid draft from a random walk over the best-fitting templates for this difficulty, experience level and skill area, widening
 * the search if they run out. Templates of a kind the user just had are tried only after the others.
 */
export async function pickTicket({ templates, difficulty, level, rng, avoidTitles, recentKinds = [], tables, runners, dialect, setupSql, areaKey = "sql", tries = 14 }: PickInput): Promise<Picked | null> {
  const seen = new Set(avoidTitles.map((t) => t.trim().toLowerCase()));
  for (const suited of templateTiers(templates, { difficulty, level, areaKey })) {
    const fresh = suited.filter((t) => !recentKinds.includes(t.taskKind));
    for (let i = 0; i < tries; i++) {
      const pool = fresh.length > 0 && i < tries / 2 ? fresh : suited;
      const draft = rng.pick(pool).build(rng);
      if (seen.has(draft.title.trim().toLowerCase())) continue;
      const verdict = await validateDraft(draft, tables, runners, { dialect, setupSql });
      if (verdict.ok) return { draft, expected: verdict.expected };
    }
  }
  return null;
}
