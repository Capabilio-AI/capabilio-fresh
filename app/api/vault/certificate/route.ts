import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";

const ALLOWED_TYPES = new Set(["application/pdf", "image/png", "image/jpeg"]);
const MAX_BYTES = 5 * 1024 * 1024;

/**
 * "Verified" here means the upload passed real integrity checks (correct
 * file type, non-empty, under the size limit) — not a claim that the
 * certificate's contents are authentic. No OCR/vision model is available
 * to this app's Groq key, so content-level verification isn't something
 * this route can honestly do.
 */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const formData = await request.formData();
  const file = formData.get("file");
  const title = formData.get("title");
  const institutionMembershipId = formData.get("institutionMembershipId");

  if (!(file instanceof File) || typeof title !== "string" || title.trim().length === 0) {
    return NextResponse.json({ error: "A file and a title are required." }, { status: 400 });
  }
  if (typeof institutionMembershipId === "string" && institutionMembershipId.length > 0) {
    const { data: membership } = await supabase
      .from("institution_memberships")
      .select("id")
      .eq("id", institutionMembershipId)
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!membership) {
      return NextResponse.json({ error: "Educational history entry not found." }, { status: 404 });
    }
  }
  if (!ALLOWED_TYPES.has(file.type)) {
    return NextResponse.json({ error: "Only PDF, JPG, or PNG files are accepted." }, { status: 400 });
  }
  if (file.size === 0 || file.size > MAX_BYTES) {
    return NextResponse.json({ error: "File must be non-empty and under 5MB." }, { status: 400 });
  }

  const extension = file.type === "application/pdf" ? "pdf" : file.type === "image/png" ? "png" : "jpg";
  const filePath = `${auth.userId}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

  const { error: uploadError } = await supabase.storage.from("certificates").upload(filePath, file, {
    contentType: file.type,
    upsert: false,
  });
  if (uploadError) {
    return NextResponse.json({ error: "Upload failed — try again." }, { status: 502 });
  }

  const { data, error } = await supabase
    .from("vault_items")
    .insert({
      user_id: auth.userId,
      item_type: "certificate",
      title: title.trim(),
      file_path: filePath,
      verified: true,
      institution_membership_id:
        typeof institutionMembershipId === "string" && institutionMembershipId.length > 0
          ? institutionMembershipId
          : null,
    })
    .select("id, item_type, title, url, description, created_at, verified, file_path")
    .single();

  if (error) {
    await supabase.storage.from("certificates").remove([filePath]);
    return NextResponse.json({ error: "Could not save certificate." }, { status: 500 });
  }

  return NextResponse.json({ item: data }, { status: 201 });
}
