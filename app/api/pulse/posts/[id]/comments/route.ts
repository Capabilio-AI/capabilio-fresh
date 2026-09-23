import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";

const CreateSchema = z.object({ content: z.string().min(1).max(1000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { id: postId } = await params;
  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: auth.userId, content: parsed.data.content })
    .select("id, content, created_at, user_id, profiles ( full_name, avatar_url )")
    .single();
  if (error) throw error;

  const author = data.profiles as { full_name: string | null; avatar_url: string | null } | null;
  return NextResponse.json(
    {
      comment: {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        author: { id: data.user_id, name: author?.full_name ?? null, avatarUrl: author?.avatar_url ?? null },
      },
    },
    { status: 201 }
  );
}
