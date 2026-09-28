import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";

const ALLOWED_TYPES = new Set(["image/png", "image/jpeg", "image/webp"]);
// The client always compresses/resizes to ~512px JPEG before this route
// ever sees the file (see lib/image/compress.ts), so a real photo lands
// well under 1MB — this is only a backstop against something malformed,
// never a limit a normal upload should hit.
const MAX_BYTES = 15 * 1024 * 1024;

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file");

  if (!(file instanceof File)) {
    return NextResponse.json({ error: "A file is required." }, { status: 400 });
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only PNG, JPG, or WEBP images are accepted." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "That image couldn't be processed — try a different photo." }, { status: 400 });
  }

  const extension = file.type === "image/png" ? "png" : file.type === "image/webp" ? "webp" : "jpg";
  // Fixed path per user (not timestamped) — a re-upload replaces the same
  // object via upsert, so old avatars don't accumulate in the bucket.
  const filePath = `${auth.userId}/avatar.${extension}`;

  const { error: uploadError } = await supabase.storage.from("avatars").upload(filePath, file, {
    contentType: file.type,
    upsert: true,
  });
  if (uploadError) {
    return NextResponse.json({ error: "Upload failed — try again." }, { status: 502 });
  }

  const {
    data: { publicUrl },
  } = supabase.storage.from("avatars").getPublicUrl(filePath);
  // Cache-bust so the new image shows immediately even though the path is
  // the same object every time (browsers/CDN would otherwise keep serving
  // the previous cached avatar at this exact URL).
  const avatarUrl = `${publicUrl}?v=${Date.now()}`;

  const { error } = await supabase.from("profiles").update({ avatar_url: avatarUrl }).eq("id", auth.userId);
  if (error) {
    return NextResponse.json({ error: "Could not save avatar." }, { status: 500 });
  }

  return NextResponse.json({ avatarUrl });
}
