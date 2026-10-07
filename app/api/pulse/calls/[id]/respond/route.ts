import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { respondToCall } from "@/lib/pulse/calls";

const Body = z.object({ action: z.enum(["accept", "decline"]) }).strict();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const id = z.string().uuid().safeParse((await params).id);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!id.success || !body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const result = await respondToCall(createServiceClient(), auth.userId, id.data, body.data.action);
  return result.ok ? NextResponse.json({ ok: true, call: result.call, ice: result.ice }) : NextResponse.json({ error: result.message }, { status: result.status });
}
