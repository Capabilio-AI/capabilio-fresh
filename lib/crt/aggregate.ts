import { CRT_MODULES, type Band, type CrtModule, type ModuleScores } from "./model";
import { bandFor, modulePct } from "./score";

export interface ResultRow {
  userId: string;
  name: string;
  branch: string | null;
  /** null until the attempt is submitted (scored) */
  totalPct: number | null;
  moduleScores: ModuleScores | null;
  started: boolean;
}

export interface CycleSummary {
  eligible: number;
  started: number;
  submitted: number;
  /** submitted / eligible, 0-100 */
  participationPct: number;
  avgPct: number | null;
  moduleAvg: Record<CrtModule, number | null>;
  bands: Record<Band, number>;
  /** the module with the lowest average, once anyone has submitted */
  weakest: CrtModule | null;
  byBranch: { branch: string; submitted: number; avgPct: number | null }[];
}

const mean = (xs: number[]): number | null => (xs.length ? Math.round((xs.reduce((a, b) => a + b, 0) / xs.length) * 10) / 10 : null);

/** Pure. `eligible` is how many students the cycle applies to (they may not have started). Branch rows are sorted by name. */
export function summarizeCycle(rows: readonly ResultRow[], eligible: number): CycleSummary {
  const done = rows.filter((r) => r.totalPct !== null && r.moduleScores);
  const moduleAvg = Object.fromEntries(
    CRT_MODULES.map((m) => [m, mean(done.filter((r) => r.moduleScores![m].max > 0).map((r) => modulePct(r.moduleScores![m])))])
  ) as Record<CrtModule, number | null>;
  const bands: Record<Band, number> = { needs_work: 0, developing: 0, proficient: 0, strong: 0 };
  for (const r of done) bands[bandFor(r.totalPct!)]++;

  const scored = CRT_MODULES.filter((m) => moduleAvg[m] !== null);
  const weakest = scored.length ? scored.reduce((lo, m) => (moduleAvg[m]! < moduleAvg[lo]! ? m : lo)) : null;

  const branches = new Map<string, number[]>();
  for (const r of done) {
    const key = r.branch?.trim() || "Branch not set";
    branches.set(key, [...(branches.get(key) ?? []), r.totalPct!]);
  }

  return {
    eligible,
    started: rows.filter((r) => r.started).length,
    submitted: done.length,
    participationPct: eligible > 0 ? Math.min(100, Math.round((done.length / eligible) * 100)) : 0,
    avgPct: mean(done.map((r) => r.totalPct!)),
    moduleAvg,
    bands,
    weakest,
    byBranch: [...branches].map(([branch, xs]) => ({ branch, submitted: xs.length, avgPct: mean(xs) })).sort((a, b) => a.branch.localeCompare(b.branch)),
  };
}

const csvCell = (v: string | number | null): string => {
  const s = v === null ? "" : String(v);
  // a cell that starts with = + - @ would run as a formula in a spreadsheet
  const safe = /^[=+\-@]/.test(s) ? `'${s}` : s;
  return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe;
};

/** Pure. One line per student of the cycle; students who did not take it have empty scores. */
export function resultsCsv(rows: readonly (ResultRow & { rollNumber?: string | null; email?: string | null })[]): string {
  const header = ["Name", "Roll number", "Email", "Branch", "Status", "Overall %", ...CRT_MODULES.map((m) => `${m} %`), "Band"];
  const lines = rows.map((r) => {
    const status = r.totalPct !== null ? "Completed" : r.started ? "Started, not finished" : "Not started";
    return [
      r.name,
      r.rollNumber ?? null,
      r.email ?? null,
      r.branch,
      status,
      r.totalPct,
      ...CRT_MODULES.map((m) => (r.moduleScores && r.moduleScores[m].max > 0 ? modulePct(r.moduleScores[m]) : null)),
      r.totalPct !== null ? bandFor(r.totalPct) : null,
    ].map(csvCell).join(",");
  });
  return [header.map(csvCell).join(","), ...lines].join("\n");
}
