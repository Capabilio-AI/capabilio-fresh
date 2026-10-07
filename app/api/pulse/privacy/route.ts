import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { untyped } from "@/lib/org/db";

const Body = z.object({ discoverable: z.boolean().optional(), showCareer: z.boolean().optional() }).strict().refine((b) => Object.keys(b).length > 0, { message: "Nothing to update." });

/** The caller's own Pulse privacy choices: appear in search and suggestions, and show the career goal under their name. */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const { data } = await untyped(createServiceClient()).from("profiles").select("pulse_discoverable, pulse_show_career").eq("id", auth.userId).maybeSingle();
  const row = data as { pulse_discoverable: boolean; pulse_show_career: boolean } | null;
  return NextResponse.json({ discoverable: row?.pulse_discoverable ?? true, showCareer: row?.pulse_show_career ?? true });
}

export async function PATCH(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const patch = { ...(body.data.discoverable !== undefined ? { pulse_discoverable: body.data.discoverable } : {}), ...(body.data.showCareer !== undefined ? { pulse_show_career: body.data.showCareer } : {}) };
  const { error } = await untyped(createServiceClient()).from("profiles").update(patch).eq("id", auth.userId);
  return error ? NextResponse.json({ error: "Couldn't save. Please try again." }, { status: 500 }) : NextResponse.json({ ok: true });
}
