import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseId } from "@/lib/curriculum/route";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getOwnedImport } from "@/lib/curriculum/admin-data";
import { publishImport, updateImport } from "@/lib/curriculum/writes";
import { regenerateForBranch } from "@/lib/roadmap-engine/regenerate";

export const maxDuration = 300;

/**
 * One step for colleges that only upload a syllabus: confirm and publish. Refused until Capabilio has finished analysing the syllabus (so what is
 * published includes the derived outcomes and skills). Anything Capabilio inferred is published as INFERRED, never as college-confirmed.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const limit = await checkRateLimit(admin.userId, { bucket: "curriculum_publish", maxRequests: 20, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const service = createServiceClient();
  const imp = await getOwnedImport(service, admin.institutionId, id.id);
  if (!imp) return NextResponse.json({ error: "Curriculum not found." }, { status: 404 });
  const enrichment = (imp as { enrichment?: { state?: string; total?: number; skillsPending?: number } }).enrichment ?? {};
  if (imp.status !== "PUBLISHED" && enrichment.state !== "DONE") {
    return NextResponse.json({ error: "Capabilio is still analysing your syllabus. Publish when it finishes.", pending: enrichment.skillsPending ?? null }, { status: 409 });
  }
  if (imp.status !== "CONFIRMED" && imp.status !== "PUBLISHED") {
    const moved = await updateImport(service, admin, id.id, { status: "CONFIRMED" });
    if (!moved.ok) return NextResponse.json({ error: moved.message }, { status: moved.status });
  }
  const result = await publishImport(service, admin, id.id);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  if (imp.branch_key) {
    after(async () => {
      try {
        await regenerateForBranch(service, admin.institutionId, imp.branch_key as string);
      } catch (error) {
        console.error("[roadmap-regeneration] after publish failed:", error instanceof Error ? error.message : error);
      }
    });
  }
  return NextResponse.json({ ok: true, versionId: result.versionId });
}
