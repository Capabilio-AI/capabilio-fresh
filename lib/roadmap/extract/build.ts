import { chunkSyllabus } from "./chunk";
import { mergeRows, type BaseRow } from "./merge";
import type { AreaOption, SubjectOutcomes } from "../suggest";
import type { SemesterChunk } from "./chunk";
import type { CandidateRow, ExtractionErrorCode, ExtractionResult } from "./types";

export class ExtractionError extends Error {
  constructor(public code: ExtractionErrorCode) {
    super(code);
  }
}

/** The two AI steps, injectable so the pipeline is testable without a model. */
export interface ExtractionDeps {
  structureSemester: (chunk: SemesterChunk) => Promise<BaseRow[]>;
  suggestAreas: (items: SubjectOutcomes[], roleName: string, areas: AreaOption[]) => Promise<Map<string, string[]>>;
}

const MAP_BATCH = 10;
const CONCURRENCY = 2;

async function pool<T>(items: T[], size: number, fn: (item: T) => Promise<void>): Promise<void> {
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(size, items.length) }, async () => {
      while (next < items.length) await fn(items[next++]);
    })
  );
}

const label = (year: number, semester: number) => `Year ${year} · Semester ${semester}`;

/**
 * PDF pages -> candidate subjects. Never the whole document at once: one AI call per semester table, then one per batch of
 * ≤10 course sections that carry Course Outcomes. A failed chunk becomes a visible warning, never a silent drop.
 */
export async function buildCandidates(
  pages: string[],
  ctx: { roleName: string; areas: AreaOption[] },
  deps: ExtractionDeps,
  onProgress: (done: number, total: number) => void | Promise<void>
): Promise<ExtractionResult> {
  const { tables, courses } = chunkSyllabus(pages);
  if (tables.length === 0 && courses.length === 0) throw new ExtractionError("unrecognised_format");

  const warnings: string[] = [];
  let done = 0;
  const total = tables.length + Math.max(1, Math.ceil(courses.length / MAP_BATCH));
  const tick = async () => onProgress(++done, total);

  const tableRows: BaseRow[] = [];
  const failedTables = new Set<string>();
  await pool(tables, CONCURRENCY, async (t) => {
    try {
      tableRows.push(...(await deps.structureSemester(t)));
    } catch {
      failedTables.add(`${t.year}-${t.semester}`);
      warnings.push(`${label(t.year, t.semester)}: the course table couldn't be read automatically. Subjects below for this semester come from the course details only — add any missing ones by hand.`);
    }
    await tick();
  });
  if (tables.length > 0 && failedTables.size === tables.length && courses.length === 0) throw new ExtractionError("ai_unavailable");

  const { rows: merged, sectionFor } = mergeRows(
    tableRows.sort((a, b) => a.year - b.year || a.semester - b.semester),
    courses
  );

  const rows: CandidateRow[] = merged.map((r, i) => ({
    ...r,
    tempId: `r${i + 1}`,
    outcomesCount: sectionFor.get(r)?.outcomes.length ?? 0,
    suggestedAreaKeys: [],
    mappingNote: (sectionFor.get(r)?.outcomes.length ?? 0) > 0 ? "not_attempted" : "no_outcomes",
  }));

  const withOutcomes = rows.filter((r) => r.outcomesCount > 0);
  const batches: CandidateRow[][] = [];
  for (let i = 0; i < withOutcomes.length; i += MAP_BATCH) batches.push(withOutcomes.slice(i, i + MAP_BATCH));
  await pool(batches, CONCURRENCY, async (batch) => {
    try {
      const items: SubjectOutcomes[] = batch.map((r) => ({ id: r.tempId, title: r.name, outcomes: sectionFor.get(merged[Number(r.tempId.slice(1)) - 1])?.outcomes ?? [] }));
      const result = await deps.suggestAreas(items, ctx.roleName, ctx.areas);
      for (const r of batch) {
        const keys = result.get(r.tempId) ?? [];
        r.suggestedAreaKeys = keys;
        r.mappingNote = keys.length > 0 ? "suggested" : "none_confident";
      }
    } catch {
      warnings.push("Skill-area suggestions couldn't be generated for some subjects — use “Suggest” on them after importing.");
    }
    await tick();
  });

  await onProgress(total, total); // the batch count was an estimate; finish exactly at 100%
  return { rows, warnings: [...new Set(warnings)] };
}
