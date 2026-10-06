import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { AddCoursesSchema } from "@/lib/curriculum/schemas";
import { addCourses } from "@/lib/curriculum/writes";

/** Add courses by hand (or from a CSV the browser already parsed). Duplicates (same year + title) are skipped. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const parsed = await parseBody(request, AddCoursesSchema);
  if ("error" in parsed) return parsed.error;
  return respond(await addCourses(createServiceClient(), admin, id.id, parsed.body.courses), 201);
}
