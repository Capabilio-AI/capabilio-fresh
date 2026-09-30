import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadRoleTaxonomy } from "@/lib/arena-workstations/taxonomy";
import { suggestAreasForOutcomes } from "../suggest";
import { structureSemester } from "./structure";
import { buildCandidates, ExtractionError, type ExtractionDeps } from "./build";
import { extractPdfPages } from "./pdf";
import { updateExtraction } from "./store";
import type { ExtractionErrorCode } from "./types";

const REAL_DEPS: ExtractionDeps = {
  structureSemester,
  suggestAreas: suggestAreasForOutcomes,
};

/** The background job (started with `after()` from the upload route). Every outcome is written to the staging row. */
export async function runExtraction(service: SupabaseClient<Database>, job: { id: string; bytes: Uint8Array; roleKey: string }, deps: ExtractionDeps = REAL_DEPS): Promise<void> {
  const fail = (code: ExtractionErrorCode) => updateExtraction(service, job.id, { status: "failed", error_code: code });
  try {
    const text = await extractPdfPages(job.bytes);
    if (!text.ok) return await fail(text.code);
    await updateExtraction(service, job.id, { page_count: text.pages.length });

    const { role, areas } = await loadRoleTaxonomy(service, job.roleKey);
    const enabled = areas.filter((a) => a.enabled).map((a) => ({ key: a.area_key, name: a.display_name }));
    const result = await buildCandidates(text.pages, { roleName: role.display_name, areas: enabled }, deps, (done, total) => updateExtraction(service, job.id, { chunks_done: done, chunks_total: total }));
    await updateExtraction(service, job.id, { status: "ready", result, error_code: null });
  } catch (error) {
    await fail(error instanceof ExtractionError ? error.code : "internal");
  }
}
