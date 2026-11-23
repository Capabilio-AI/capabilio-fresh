import type { ModuleEvidenceEntry } from "./credential";

/** Pure. The headline numbers of a credential's evidence, from what is signed. A number that was not recorded for a module is left out of the total, never counted as zero. */
export function summarise(modules: readonly ModuleEvidenceEntry[]) {
  const scored = modules.filter((m) => m.sc !== null && m.st !== null);
  const sc = scored.reduce((n, m) => n + (m.sc ?? 0), 0);
  const st = scored.reduce((n, m) => n + (m.st ?? 0), 0);
  const withTests = modules.filter((m) => m.tp !== null && m.tn !== null);
  const dates = modules.map((m) => m.p).sort();
  return {
    modules: modules.length,
    testPct: st > 0 ? Math.round((sc / st) * 100) : null,
    problems: modules.filter((m) => m.pl !== null).length,
    testsPassed: withTests.reduce((n, m) => n + (m.tp ?? 0), 0),
    testsTotal: withTests.reduce((n, m) => n + (m.tn ?? 0), 0),
    languages: [...new Set(modules.flatMap((m) => (m.pl ? [m.pl] : [])))],
    tries: modules.reduce((n, m) => n + m.aa + m.pa, 0),
    first: dates[0] ?? "",
    last: dates[dates.length - 1] ?? "",
  };
}

export const day = (iso: string): string => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" });
