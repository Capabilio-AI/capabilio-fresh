import { NextResponse } from "next/server";
import { randomUUID } from "node:crypto";
import { authorizeOrg } from "@/lib/api/org-route";
import { MAX_MEDIA_BYTES, mediaPath, ownPathFromPublicUrl, sniffImage, type MediaKind } from "@/lib/org/media";
import { untyped, type OrgProfileRow } from "@/lib/org/db";

const BUCKET = "org-media";
const KINDS: readonly MediaKind[] = ["logo", "cover", "post"];

/**
 * Upload a college picture. Logo/cover need the College-page permission, post photos need Posts. The image type is
 * read from the file's bytes, the path is scoped to the caller's own institution, and logo/cover are attached to the
 * profile here (the browser never supplies the URL).
 */
export async function POST(request: Request) {
  const form = await request.formData().catch(() => null);
  const kind = String(form?.get("kind") ?? "") as MediaKind;
  const file = form?.get("file");
  if (!KINDS.includes(kind) || !(file instanceof File)) return NextResponse.json({ error: "Choose an image to upload." }, { status: 400 });

  const env = await authorizeOrg(kind === "post" ? "publishPost" : "manageProfile");
  if (env instanceof NextResponse) return env;
  const { ctx, service } = env;

  if (file.size === 0 || file.size > MAX_MEDIA_BYTES) return NextResponse.json({ error: "Images must be under 5 MB." }, { status: 413 });
  const bytes = new Uint8Array(await file.arrayBuffer());
  const image = sniffImage(bytes);
  if (!image) return NextResponse.json({ error: "Upload a PNG, JPG or WebP image." }, { status: 415 });

  const path = mediaPath(ctx.institutionId, kind, image.ext, randomUUID());
  const { error: uploadError } = await service.storage.from(BUCKET).upload(path, bytes, { contentType: image.contentType, upsert: false });
  if (uploadError) return NextResponse.json({ error: "Upload failed. Please try again." }, { status: 500 });
  const url = service.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

  if (kind !== "post") {
    const column = kind === "logo" ? "logo_url" : "cover_image_url";
    const db = untyped(service);
    const { data: before } = await db.from("org_profiles").select("*").eq("institution_id", ctx.institutionId).maybeSingle();
    const { error } = await db.from("org_profiles").upsert({ institution_id: ctx.institutionId, [column]: url, updated_at: new Date().toISOString() });
    if (error) return NextResponse.json({ error: "Could not save the picture." }, { status: 500 });
    const old = ownPathFromPublicUrl((before as OrgProfileRow | null)?.[column] ?? null, BUCKET, ctx.institutionId);
    if (old) await service.storage.from(BUCKET).remove([old]);
  }
  return NextResponse.json({ ok: true, url });
}
