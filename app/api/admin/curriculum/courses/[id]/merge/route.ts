import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { parseBody, parseId, respond } from "@/lib/curriculum/route";
import { MergeSchema } from "@/lib/curriculum/schemas";
import { mergeCourse } from "@/lib/curriculum/writes";

/** Merge this course INTO another course of the same curriculum. Skill mappings are not carried over. */
export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = await parseId(params);
  if ("error" in id) return id.error;
  const parsed = await parseBody(request, MergeSchema);
  if ("error" in parsed) return parsed.error;
  return respond(await mergeCourse(createServiceClient(), admin, id.id, parsed.body.intoCourseId));
}
