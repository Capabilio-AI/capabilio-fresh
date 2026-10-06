import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { ConfirmHighSchema } from "@/lib/curriculum/schemas";
import { confirmHighConfidence } from "@/lib/curriculum/mapping-writes";

/** Two explicit steps: preview=true lists what would be confirmed; preview=false (with that list's size) confirms exactly that. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const parsed = await parseBody(request, ConfirmHighSchema);
  if ("error" in parsed) return parsed.error;
  return respond(await confirmHighConfidence(createServiceClient(), admin, id.id, parsed.body));
}
