import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadRoleTaxonomy } from "@/lib/arena-workstations/taxonomy";
import { EXTRACTION_MODEL, structureCourseSection, suggestAreasForOutcomes } from "../suggest";
import { structureSemester } from "./structure";
import { buildCandidates, ExtractionError, type ExtractionDeps } from "./build";
import { extractPdfPages } from "./pdf";
import { detectRegulation, parseProgramOutcomes } from "./programs";
import { enrichImport } from "./derive";
import { saveExtractionAsImport, type PersistCourse } from "./persist";
import { reportProgress, updateExtraction } from "./store";
import type { ExtractionErrorCode } from "./types";

type Service = SupabaseClient<Database>;
export const EXTRACTION_VERSION = "p3-1";
const SAVE_ATTEMPTS = 2;
const ENRICH_BUDGET_MS = 150_000;

/** The background job (started with `after()` from the upload route). Every outcome is written to the staging row. */
export async function runExtraction(
  service: Service,
  job: { id: string; institutionId: string; userId: string; branch: string; fileName: string; bytes: Uint8Array; roleKey: string },
  depsOverride?: ExtractionDeps
): Promise<void> {
  const fail = (code: ExtractionErrorCode) => updateExtraction(service, job.id, { status: "failed", error_code: code }).catch((e) => console.error("[curriculum-extraction] could not record the failure:", e instanceof Error ? e.message : e));
  try {
    const text = await extractPdfPages(job.bytes);
    if (!text.ok) return await fail(text.code);
    await reportProgress(service, job.id, { page_count: text.pages.length });

    const { role, areas } = await loadRoleTaxonomy(service, job.roleKey);
    const enabled = areas.filter((a) => a.enabled).map((a) => ({ key: a.area_key, name: a.display_name }));
    const deps: ExtractionDeps = depsOverride ?? { structureSemester, suggestAreas: suggestAreasForOutcomes, structureSection: structureCourseSection };

    const built = await buildCandidates(text.pages, { roleName: role.display_name, areas: enabled }, deps, (done, total) => reportProgress(service, job.id, { chunks_done: done, chunks_total: total }));
    const warnings = [...built.warnings];

    // Structure only. Skill suggestions are a separate, explicit step (suggest-skills.ts): bounded per request, resumable, never part of the upload.
    const persistCourses: PersistCourse[] = built.rows.map((row) => {
      const rich = built.rich.find((r) => r.tempId === row.tempId)!;
      return { row, parsed: rich.parsed, structuredBy: rich.structuredBy, mappings: [], pageStart: rich.pageStart, pageEnd: rich.pageEnd };
    });

    let importId: string | null = null;
    const { regulation, program } = detectRegulation(text.header);
    const programOutcomes = parseProgramOutcomes(text.pages);
    const save = () =>
      saveExtractionAsImport(service, {
        institutionId: job.institutionId, userId: job.userId, branch: job.branch, fileName: job.fileName, regulation, program,
        courses: persistCourses, outcomes: [...programOutcomes.pos, ...programOutcomes.psos],
        summary: { warnings, aiFallbackCourses: built.rich.filter((r) => r.structuredBy === "ai").length },
        model: EXTRACTION_MODEL, version: EXTRACTION_VERSION,
      });
    // A failed save deletes its own draft, so one retry is safe (it rides out a dropped connection among the ~15 writes).
    for (let attempt = 1; attempt <= SAVE_ATTEMPTS && !importId; attempt++) {
      try {
        importId = await save();
      } catch (error) {
        console.error(`[curriculum-extraction] saving the draft import failed (attempt ${attempt}/${SAVE_ATTEMPTS}) for extraction ${job.id}:`, error instanceof Error ? error.message : error);
      }
    }
    if (!importId) warnings.push("The detailed curriculum draft (outcomes, units, labs) could not be saved. The subject list below is unaffected.");
    await updateExtraction(service, job.id, { status: "ready", result: { rows: built.rows, warnings: [...new Set(warnings)], importId }, import_id: importId, error_code: null });
    // The college only uploads the PDF: Capabilio now derives outcomes where the syllabus prints none and suggests skills per course and unit.
    // Bounded by what is left of this job; the college's page and the daily job continue it until it is done.
    if (importId && !depsOverride) {
      await enrichImport(service, importId, { institutionId: job.institutionId }, { budgetMs: ENRICH_BUDGET_MS }).catch((e) => console.error("[curriculum-enrichment] after extraction:", e instanceof Error ? e.message : e));
    }
  } catch (error) {
    await fail(error instanceof ExtractionError ? error.code : "internal");
  }
}
