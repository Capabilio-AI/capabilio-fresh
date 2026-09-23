import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";

/** Toggle: liked -> unlike, not liked -> like. Returns the new state. */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { id: postId } = await params;

  const { data: existing } = await supabase
    .from("post_likes")
    .select("post_id")
    .eq("post_id", postId)
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("post_likes")
      .delete()
      .eq("post_id", postId)
      .eq("user_id", auth.userId);
    if (error) throw error;
    return NextResponse.json({ liked: false });
  }

  const { error } = await supabase.from("post_likes").insert({ post_id: postId, user_id: auth.userId });
  if (error) throw error;
  return NextResponse.json({ liked: true });
}
