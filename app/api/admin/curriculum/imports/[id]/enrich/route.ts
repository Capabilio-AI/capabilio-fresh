import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseId } from "@/lib/curriculum/route";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getOwnedImport } from "@/lib/curriculum/admin-data";
import { enrichImport } from "@/lib/roadmap/extract/derive";

export const maxDuration = 300;

/** Continues the automatic analysis of the caller's own unpublished curriculum (bounded; call again until it reports DONE). */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const limit = await checkRateLimit(admin.userId, { bucket: "curriculum_enrich", maxRequests: 30, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const service = createServiceClient();
  if (!(await getOwnedImport(service, admin.institutionId, id.id))) return NextResponse.json({ error: "Curriculum not found." }, { status: 404 });
  try {
    return NextResponse.json(await enrichImport(service, id.id, { institutionId: admin.institutionId }, { budgetMs: 240_000 }));
  } catch (error) {
    console.error("[curriculum-enrichment]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "The analysis could not continue. Try again." }, { status: 500 });
  }
}
