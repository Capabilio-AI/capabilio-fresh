import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { RemoveCoursesSchema } from "@/lib/curriculum/schemas";
import { removeCourses } from "@/lib/curriculum/writes";

/** Remove several courses at once, e.g. the elective options a college does not offer. Restorable until the curriculum is published. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const parsed = await parseBody(request, RemoveCoursesSchema);
  if ("error" in parsed) return parsed.error;
  return respond(await removeCourses(createServiceClient(), admin, id.id, parsed.body.courseIds));
}
