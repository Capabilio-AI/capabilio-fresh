import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, respond } from "@/lib/curriculum/route";
import { AssignRegulationSchema } from "@/lib/curriculum/schemas";
import { assignRegulation } from "@/lib/curriculum/cohorts";

/** A college links its students to a regulation in bulk, so each gets the right curriculum without every student setting it themselves. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const parsed = await parseBody(request, AssignRegulationSchema);
  if ("error" in parsed) return parsed.error;
  const result = await assignRegulation(createServiceClient(), admin.institutionId, parsed.body);
  return respond(result.ok ? result : { ok: false, status: result.status, message: result.message });
}
