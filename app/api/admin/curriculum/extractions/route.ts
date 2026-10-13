import { NextResponse } from "next/server";
import { after } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { listEnabledRoles } from "@/lib/arena-workstations/taxonomy";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { checkPdfBytes } from "@/lib/roadmap/extract/pdf";
import { MAX_SYLLABUS_BYTES, MAX_SYLLABUS_MB, SYLLABUS_BUCKET } from "@/lib/roadmap/extract/limits";
import { createExtraction, hasActiveJob, updateExtraction } from "@/lib/roadmap/extract/store";
import { runExtraction } from "@/lib/roadmap/extract/run";

// The job runs after the response (via after()) for up to this long; the real 158-page syllabus takes ~90 s.
export const maxDuration = 300;

/**
 * Start an extraction for a syllabus PDF the browser has already sent to private storage (see ./upload-url). Validates the file, stages a `processing` record for the caller's OWN institution and
 * returns 202 immediately; the extraction runs in the background. Nothing here writes to the curriculum tables.
 */
export async function POST(request: Request) {
  try {
    return await startExtraction(request);
  } catch (e) {
    console.error("[curriculum-extraction] start failed", e);
    return NextResponse.json({ error: "Could not start the extraction." }, { status: 500 });
  }
}

async function startExtraction(request: Request) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;

  const limit = await checkRateLimit(admin.userId, { bucket: "curriculum_extract", maxRequests: 5, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const body = (await request.json().catch(() => null)) as Record<string, unknown> | null;
  const path = String(body?.path ?? "");
  const fileName = String(body?.fileName ?? "").trim().slice(0, 200) || "syllabus.pdf";
  const branch = String(body?.branch ?? "").trim();
  const roleKey = String(body?.roleKey ?? "").trim();
  const regulation = String(body?.regulation ?? "").trim() || null;
  if (regulation && regulation.length > 80) return NextResponse.json({ error: "The regulation is too long." }, { status: 400 });
  // The file must be one this institution's own upload-url call issued (its folder, a plain uuid.pdf name).
  if (!path.startsWith(`${admin.institutionId}/`) || !/^[0-9a-f-]{36}\/[0-9a-f-]{36}\.pdf$/.test(path) || branch.length < 1 || branch.length > 200) {
    return NextResponse.json({ error: "Choose a branch and a syllabus PDF." }, { status: 400 });
  }

  const service = createServiceClient();
  const download = await service.storage.from(SYLLABUS_BUCKET).download(path);
  if (download.error || !download.data) return NextResponse.json({ error: "The upload didn't arrive. Please try again." }, { status: 400 });
  const removeUpload = () => service.storage.from(SYLLABUS_BUCKET).remove([path]).catch(() => undefined);

  // Validate before anything is processed.
  if (download.data.size > MAX_SYLLABUS_BYTES) {
    await removeUpload();
    return NextResponse.json({ error: `The PDF must be under ${MAX_SYLLABUS_MB} MB.` }, { status: 413 });
  }
  const bytes = new Uint8Array(await download.data.arrayBuffer());
  const check = checkPdfBytes(bytes, MAX_SYLLABUS_BYTES);
  if (!check.ok) {
    await removeUpload();
    return NextResponse.json({ error: check.message }, { status: check.status });
  }

  const roles = await listEnabledRoles(service);
  if (!roles.some((r) => r.role_key === roleKey)) {
    await removeUpload();
    return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  }
  if (await hasActiveJob(service, admin.institutionId)) {
    await removeUpload();
    return NextResponse.json({ error: "A syllabus is already being read for your institution. Wait for it to finish." }, { status: 409 });
  }

  const id = await createExtraction(service, { institutionId: admin.institutionId, userId: admin.userId, branch, roleKey, fileName, fileBytes: bytes.length });
  if (!id) {
    await removeUpload();
    return NextResponse.json({ error: "Could not start the extraction." }, { status: 500 });
  }

  after(async () => {
    try {
      await runExtraction(service, { id, institutionId: admin.institutionId, userId: admin.userId, branch, fileName, bytes, roleKey, regulation });
    } catch {
      await updateExtraction(service, id, { status: "failed", error_code: "internal" }).catch(() => undefined);
    } finally {
      await removeUpload();
    }
  });
  return NextResponse.json({ ok: true, id }, { status: 202 });
}
