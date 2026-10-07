import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { createServiceClient } from "@/lib/supabase/service";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { loadPeople } from "@/lib/pulse/people";

const CreateSchema = z.object({ content: z.string().min(1).max(1000) });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const limit = await checkRateLimit(auth.userId, { bucket: "pulse_comment", maxRequests: 60, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const { id: postId } = await params;
  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase
    .from("post_comments")
    .insert({ post_id: postId, user_id: auth.userId, content: parsed.data.content })
    .select("id, content, created_at, user_id")
    .single();
  if (error) throw error;

  const author = (await loadPeople(createServiceClient(), [data.user_id])).get(data.user_id);
  return NextResponse.json(
    {
      comment: {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        author: { id: data.user_id, name: author?.name ?? null, avatarUrl: author?.avatarUrl ?? null, headline: author?.headline ?? null },
      },
    },
    { status: 201 }
  );
}
