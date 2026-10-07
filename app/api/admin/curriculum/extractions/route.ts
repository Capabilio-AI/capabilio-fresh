import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { listEnabledRoles } from "@/lib/arena-workstations/taxonomy";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { checkPdfBytes } from "@/lib/roadmap/extract/pdf";
import { createExtraction, hasActiveJob, updateExtraction } from "@/lib/roadmap/extract/store";
import { runExtraction } from "@/lib/roadmap/extract/run";

// The job runs after the response (via after()) for up to this long; the real 158-page syllabus takes ~90 s.
export const maxDuration = 300;

/**
 * Upload a syllabus PDF for extraction. Validates the file, stages a `processing` record for the caller's OWN institution and
 * returns 202 immediately; the extraction runs in the background. Nothing here writes to the curriculum tables.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;

  const limit = await checkRateLimit(admin.userId, { bucket: "curriculum_extract", maxRequests: 5, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const branch = String(form?.get("branch") ?? "").trim();
  const roleKey = String(form?.get("roleKey") ?? "").trim();
  const regulation = String(form?.get("regulation") ?? "").trim() || null;
  if (regulation && regulation.length > 80) return NextResponse.json({ error: "The regulation is too long." }, { status: 400 });
  if (!(file instanceof File) || branch.length < 1 || branch.length > 200) return NextResponse.json({ error: "Choose a branch and a syllabus PDF." }, { status: 400 });

  // Validate before anything is processed or stored.
  if (file.size > 16 * 1024 * 1024) return NextResponse.json({ error: "The PDF must be under 15 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const check = checkPdfBytes(bytes);
  if (!check.ok) return NextResponse.json({ error: check.message }, { status: check.status });

  const service = createServiceClient();
  const roles = await listEnabledRoles(service);
  if (!roles.some((r) => r.role_key === roleKey)) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  if (await hasActiveJob(service, admin.institutionId)) return NextResponse.json({ error: "A syllabus is already being read for your institution. Wait for it to finish." }, { status: 409 });

  const id = await createExtraction(service, { institutionId: admin.institutionId, userId: admin.userId, branch, roleKey, fileName: file.name || "syllabus.pdf", fileBytes: bytes.length });
  if (!id) return NextResponse.json({ error: "Could not start the extraction." }, { status: 500 });

  after(async () => {
    try {
      await runExtraction(service, { id, institutionId: admin.institutionId, userId: admin.userId, branch, fileName: file.name || "syllabus.pdf", bytes, roleKey, regulation });
    } catch {
      await updateExtraction(service, id, { status: "failed", error_code: "internal" }).catch(() => undefined);
    }
  });
  return NextResponse.json({ ok: true, id }, { status: 202 });
}
