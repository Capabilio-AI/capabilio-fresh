import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { CourseTreeSchema } from "@/lib/curriculum/schemas";
import { saveCourse, setCourseRemoved } from "@/lib/curriculum/writes";

type Ctx = { params: Promise<{ id: string }> };

/** Save the course and its outcomes, units, topics and labs in one transaction. */
export async function PUT(request: Request, { params }: Ctx) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const parsed = await parseBody(request, CourseTreeSchema);
  if ("error" in parsed) return parsed.error;
  return respond(await saveCourse(createServiceClient(), admin, id.id, parsed.body));
}

/** Soft delete: the course moves to "Removed" and can be restored until the curriculum is published. */
export async function DELETE(_request: Request, { params }: Ctx) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  return respond(await setCourseRemoved(createServiceClient(), admin, id.id, true));
}
