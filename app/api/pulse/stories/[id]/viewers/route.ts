import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { storyViewers } from "@/lib/pulse/stories";

/** Only the story's owner can see who viewed it. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const viewers = await storyViewers(createServiceClient(), auth.userId, id.data);
  return viewers ? NextResponse.json({ viewers }) : NextResponse.json({ error: "Story not found." }, { status: 404 });
}
