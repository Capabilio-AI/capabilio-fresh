import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { UpdateImportSchema } from "@/lib/curriculum/schemas";
import { removeImport, updateImport } from "@/lib/curriculum/writes";

type Ctx = { params: Promise<{ id: string }> };

/** Edit regulation/program/branch and move through the review statuses. PUBLISHED is unreachable here. */
export async function PATCH(request: Request, { params }: Ctx) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const parsed = await parseBody(request, UpdateImportSchema);
  if ("error" in parsed) return parsed.error;
  return respond(await updateImport(createServiceClient(), admin, id.id, parsed.body));
}

/** Soft delete an unpublished curriculum. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  return respond(await removeImport(createServiceClient(), admin, id.id));
}
