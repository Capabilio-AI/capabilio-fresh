import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { importTemplate } from "@/lib/curriculum/template/import";

const MAX_BYTES = 5 * 1024 * 1024;

/** Upload a filled Capabilio curriculum template for one branch and regulation. Becomes a draft curriculum for the caller's OWN institution. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const limit = await checkRateLimit(admin.userId, { bucket: "curriculum_template", maxRequests: 30, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const branch = String(form?.get("branch") ?? "").trim();
  const regulation = String(form?.get("regulation") ?? "").trim() || null;
  const program = String(form?.get("program") ?? "").trim() || null;
  if (!(file instanceof File) || branch.length < 1 || branch.length > 200) return NextResponse.json({ error: "Choose a branch and the filled template file." }, { status: 400 });
  if ((regulation?.length ?? 0) > 80 || (program?.length ?? 0) > 200) return NextResponse.json({ error: "The regulation or program is too long." }, { status: 400 });
  if (file.size > MAX_BYTES) return NextResponse.json({ error: "The file must be under 5 MB." }, { status: 413 });
  if (!/\.(csv|txt)$/i.test(file.name)) return NextResponse.json({ error: "Upload the template as a .csv file (in Excel: Save As → CSV UTF-8)." }, { status: 415 });

  try {
    const result = await importTemplate(createServiceClient(), admin, { branch, regulation, program, fileName: file.name.slice(0, 300), text: await file.text() });
    if (!result.ok) return NextResponse.json({ error: result.message, issues: result.issues }, { status: result.status });
    return NextResponse.json({ ok: true, id: result.importId, courses: result.courses, warnings: result.warnings }, { status: 201 });
  } catch (error) {
    console.error("[curriculum-template]", error instanceof Error ? error.message : error);
    return NextResponse.json({ error: "Could not save the curriculum. Nothing was changed — please try again." }, { status: 500 });
  }
}
