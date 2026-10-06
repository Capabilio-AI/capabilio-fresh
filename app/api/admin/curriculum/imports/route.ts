import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { CreateImportSchema } from "@/lib/curriculum/schemas";
import { createImport } from "@/lib/curriculum/writes";

/** Start a blank curriculum (no PDF) for a branch of the caller's own institution. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const parsed = await parseBody(request, CreateImportSchema);
  if ("error" in parsed) return parsed.error;
  return respond(await createImport(createServiceClient(), admin, parsed.body), 201);
}
