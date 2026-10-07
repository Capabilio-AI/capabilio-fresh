import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { loadThread } from "@/lib/pulse/messages";

const Query = z.object({ before: z.string().datetime({ offset: true }).optional() });

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  const query = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!id.success || !query.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const thread = await loadThread(createServiceClient(), auth.userId, id.data, query.data.before ?? null);
  return thread ? NextResponse.json(thread) : NextResponse.json({ error: "Conversation not found." }, { status: 404 });
}
