import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseId, respond } from "@/lib/curriculum/route";
import { createNewVersion } from "@/lib/curriculum/writes";

/** Copy a published curriculum into a new editable version; publishing it later archives the one it was copied from. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  return respond(await createNewVersion(createServiceClient(), admin, id.id), 201);
}
