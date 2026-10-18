import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { untyped } from "@/lib/org/db";

const Body = z.union([z.object({ all: z.literal(true) }).strict(), z.object({ ids: z.array(z.string().uuid()).min(1).max(100) }).strict()]);

/** Mark some (or all) of your own notifications as read. Other people's ids simply match nothing. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const parsed = Body.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  let q = untyped(createServiceClient()).from("notifications").update({ read_at: new Date().toISOString() }).eq("user_id", auth.userId).is("read_at", null);
  if ("ids" in parsed.data) q = q.in("id", parsed.data.ids);
  const { error } = await q;
  if (error) return NextResponse.json({ error: "Could not update notifications." }, { status: 500 });
  return NextResponse.json({ ok: true });
}
