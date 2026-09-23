import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { getFeed } from "@/lib/pulse/data";

const CreateSchema = z.object({ content: z.string().min(1).max(3000) });

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const posts = await getFeed(supabase, auth.userId);
  return NextResponse.json({ posts });
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = CreateSchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { error } = await supabase.from("posts").insert({ user_id: auth.userId, content: parsed.data.content });
  if (error) throw error;

  const posts = await getFeed(supabase, auth.userId);
  return NextResponse.json({ posts }, { status: 201 });
}
