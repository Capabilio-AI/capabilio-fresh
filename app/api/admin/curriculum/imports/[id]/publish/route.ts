import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { publishImport } from "@/lib/curriculum/writes";

/** Publish a CONFIRMED curriculum: immutable version, previous version of the same regulation archived. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const limit = await checkRateLimit(admin.userId, { bucket: "curriculum_publish", maxRequests: 20, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  return respond(await publishImport(createServiceClient(), admin, id.id));
}
