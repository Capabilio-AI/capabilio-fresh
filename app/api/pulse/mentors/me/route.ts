import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { setAccepting } from "@/lib/pulse/mentors";

const Body = z.object({ isAccepting: z.boolean() }).strict();

/** An approved mentor pauses or resumes new requests. */
export async function PATCH(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  return (await setAccepting(createServiceClient(), auth.userId, body.data.isAccepting)) ? NextResponse.json({ ok: true }) : NextResponse.json({ error: "Only approved mentors can change this." }, { status: 403 });
}
