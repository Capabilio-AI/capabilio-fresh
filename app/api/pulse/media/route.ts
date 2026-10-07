import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { uploadImage, type Purpose } from "@/lib/pulse/media";

/** Uploads one image (story or post) or one PDF document (post attachment). The file's real type is read from its bytes; the path is always inside the caller's own folder. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "pulse_media", maxRequests: 30, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  const purpose = String(form?.get("purpose") ?? "");
  if (!(file instanceof File) || (purpose !== "story" && purpose !== "post" && purpose !== "doc")) return NextResponse.json({ error: "Choose a file." }, { status: 400 });
  const result = await uploadImage(createServiceClient(), auth.userId, purpose as Purpose, file);
  return result.ok ? NextResponse.json({ ok: true, path: result.path, name: file.name.slice(0, 200), size: file.size }, { status: 201 }) : NextResponse.json({ error: result.message }, { status: result.status });
}
