import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { DecisionsSchema } from "@/lib/curriculum/schemas";
import { applyDecisions } from "@/lib/curriculum/mapping-writes";

/** The college's confirm / reject / clear decisions on a course's skills (and, with outcomeId, an outcome's). */
export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const parsed = await parseBody(request, DecisionsSchema);
  if ("error" in parsed) return parsed.error;
  return respond(await applyDecisions(createServiceClient(), admin, id.id, parsed.body.decisions));
}
