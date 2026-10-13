import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { MAX_SYLLABUS_BYTES, MAX_SYLLABUS_MB, SYLLABUS_BUCKET } from "@/lib/roadmap/extract/limits";

/**
 * Step 1 of a syllabus upload: hand the signed-in curriculum admin a one-time signed URL so the browser can send the PDF
 * straight to private storage (a 50 MB file cannot pass through a serverless function). The object lives under the caller's
 * OWN institution folder and is deleted once the extraction has read it.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;

  const limit = await checkRateLimit(admin.userId, { bucket: "curriculum_upload", maxRequests: 10, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const body = (await request.json().catch(() => null)) as { size?: unknown } | null;
  const size = typeof body?.size === "number" ? body.size : 0;
  if (size <= 0) return NextResponse.json({ error: "Choose a syllabus PDF." }, { status: 400 });
  if (size > MAX_SYLLABUS_BYTES) return NextResponse.json({ error: `The PDF must be under ${MAX_SYLLABUS_MB} MB.` }, { status: 413 });

  const service = createServiceClient();
  const existing = await service.storage.getBucket(SYLLABUS_BUCKET);
  if (existing.error) {
    const created = await service.storage.createBucket(SYLLABUS_BUCKET, { public: false, fileSizeLimit: MAX_SYLLABUS_BYTES, allowedMimeTypes: ["application/pdf"] });
    if (created.error && !/already exists/i.test(created.error.message)) return NextResponse.json({ error: "Could not prepare the upload." }, { status: 500 });
  }

  const path = `${admin.institutionId}/${crypto.randomUUID()}.pdf`;
  const signed = await service.storage.from(SYLLABUS_BUCKET).createSignedUploadUrl(path);
  if (signed.error || !signed.data) return NextResponse.json({ error: "Could not prepare the upload." }, { status: 500 });
  return NextResponse.json({ path, token: signed.data.token });
}
