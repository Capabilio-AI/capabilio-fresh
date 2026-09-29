import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { SubjectsBodySchema } from "@/lib/roadmap/schemas";
import { addSubjects } from "@/lib/roadmap/curriculum-writes";

/** Add subjects (branch + year) to the caller's OWN institution. Org admins only. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;

  const parsed = SubjectsBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await addSubjects(createServiceClient(), admin, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, added: result.count });
}
