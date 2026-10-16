import { applySteps, noOpSteps } from "@/lib/arena-workstations/engines/cleaning";
import { evaluateSpec, suitableChartTypes } from "@/lib/arena-workstations/engines/bi";
import { computeExpected, type ExpectedAnswer } from "@/lib/arena-workstations/engines/stats";
import { buildLayout, computeExpectedCells, type SheetLayout } from "@/lib/arena-workstations/engines/spreadsheet";
import type { Dataset } from "@/lib/arena-workstations/engines/dataset";
import type { Difficulty } from "@/lib/arena-workstations/types";
import type { ExperienceLevel } from "../level";
import type { Rng } from "../rng";
import { templateTiers } from "../tickets/pick";
import type { CleanDraft, DashboardDraft, SheetDraft, StatsDraft } from "./types";

export type Checked<T> = { ok: true; value: T } | { ok: false; reason: string };

/** A sheet ticket is only served if the engine can lay it out and compute every expected cell from the data. */
export function checkSheet(draft: SheetDraft): Checked<{ layout: SheetLayout; expected: Record<string, number> }> {
  if (draft.content.data.rows.length < 12) return { ok: false, reason: `only ${draft.content.data.rows.length} rows of data` };
  try {
    const layout = buildLayout(draft.content);
    const expected = computeExpectedCells(draft.content, layout);
    if (Object.values(expected).some((v) => !Number.isFinite(v))) return { ok: false, reason: "a non-finite expected value" };
    return { ok: true, value: { layout, expected } };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** A cleaning ticket is only served if every step really changes the data and a usable table is left. */
export function checkClean(draft: CleanDraft): Checked<{ expectedRows: number }> {
  try {
    const raw = draft.dataset;
    if (raw.rows.length < 40) return { ok: false, reason: `only ${raw.rows.length} raw rows` };
    const idle = noOpSteps(raw, draft.steps);
    if (idle.length) return { ok: false, reason: `steps ${idle.map((i) => i + 1).join(", ")} change nothing` };
    const clean = applySteps(raw, draft.steps);
    if (clean.rows.length < 10) return { ok: false, reason: `only ${clean.rows.length} clean rows` };
    return { ok: true, value: { expectedRows: clean.rows.length } };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** What the picker needs of a template. Returning null means "not with this user's data"; the picker tries another. */
/** A dashboard ticket is only served if its chart has a sensible number of points, a chart type that suits the data, and no tie at the cut-off of a top-N. */
export function checkDashboard(draft: DashboardDraft): Checked<{ points: number }> {
  try {
    const series = evaluateSpec(draft.dataset, draft.spec);
    if (series.length < 2 || series.length > 20) return { ok: false, reason: `the chart has ${series.length} points` };
    if (!suitableChartTypes(draft.dataset, draft.spec, series.length).includes(draft.spec.chart_type)) return { ok: false, reason: "the chart type does not suit the data" };
    const { limit } = draft.spec;
    if (limit !== null) {
      const all = evaluateSpec(draft.dataset, { ...draft.spec, limit: null });
      if (all.length > limit && all[limit - 1].value === all[limit].value) return { ok: false, reason: "a tie at the cut-off" };
      if (all.length <= limit) return { ok: false, reason: "the limit does not cut anything off" };
    }
    return { ok: true, value: { points: series.length } };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

/** A statistics ticket is only served if enough rows are there and every question has a computable, non-degenerate answer. */
export function checkStats(draft: StatsDraft): Checked<{ expected: ExpectedAnswer[] }> {
  if (draft.dataset.rows.length < 30) return { ok: false, reason: `only ${draft.dataset.rows.length} rows` };
  try {
    const expected = draft.questions.flatMap((q) => computeExpected(draft.dataset, q));
    if (expected.some((e) => typeof e.value === "number" && !Number.isFinite(e.value))) return { ok: false, reason: "a non-finite answer" };
    return { ok: true, value: { expected } };
  } catch (e) {
    return { ok: false, reason: (e as Error).message };
  }
}

interface Buildable<D> {
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  areas?: string[];
  build(rng: Rng, tables: Dataset[]): D | null;
}

interface PickInput<D> {
  templates: readonly Buildable<D>[];
  areaKey: string;
  difficulty: Difficulty;
  level: ExperienceLevel;
  rng: Rng;
  avoidTitles: readonly string[];
  tables: Dataset[];
  tries?: number;
}

/** First valid ticket from a random walk over the best-fitting templates, widening the search if they run out (same rules as the SQL tickets). */
export function pickOffice<D extends { title: string }, V>(input: PickInput<D>, check: (draft: D) => Checked<V>): { draft: D; checked: V } | null {
  const { templates, areaKey, difficulty, level, rng, avoidTitles, tables, tries = 12 } = input;
  const seen = new Set(avoidTitles.map((t) => t.trim().toLowerCase()));
  for (const tier of templateTiers(templates, { difficulty, level, areaKey })) {
    for (let i = 0; i < tries; i++) {
      const draft = rng.pick(tier).build(rng, tables);
      if (!draft) continue;
      if (seen.has(draft.title.trim().toLowerCase())) continue;
      const verdict = check(draft);
      if (verdict.ok) return { draft, checked: verdict.value };
    }
  }
  return null;
}
