import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { publishImport } from "@/lib/curriculum/writes";
import { getOwnedImport } from "@/lib/curriculum/admin-data";
import { regenerateForBranch } from "@/lib/roadmap-engine/regenerate";

// The regeneration for the branch's students runs after the response, within this limit.
export const maxDuration = 300;

/** Publish a CONFIRMED curriculum: immutable version, previous version of the same regulation archived. */
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
  const result = await publishImport(service, admin, id.id);
  // A new curriculum version changes the inputs of that branch's students: bring their roadmaps up to date in the background (bounded, idempotent).
  if (result.ok && imp?.branch_key) {
    after(async () => {
      try {
        await regenerateForBranch(service, admin.institutionId, imp.branch_key as string);
      } catch (error) {
        console.error("[roadmap-regeneration] after publish failed:", error instanceof Error ? error.message : error);
      }
    });
  }
  return respond(result);
}
