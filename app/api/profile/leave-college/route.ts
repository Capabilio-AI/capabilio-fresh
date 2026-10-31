import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { untyped } from "@/lib/org/db";

/** A student leaves their college: the membership is closed (not deleted), so the college's counts drop at once. Staff roles are never touched. */
export async function POST() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const { data, error } = await untyped(createServiceClient())
    .from("institution_memberships")
    .update({ status: "revoked" })
    .eq("user_id", auth.userId)
    .eq("role", "student")
    .eq("status", "active")
    .select("id");
  if (error) return NextResponse.json({ error: "Couldn't update. Please try again." }, { status: 500 });
  if (!data || data.length === 0) return NextResponse.json({ error: "You aren't a student of a college right now." }, { status: 404 });
  return NextResponse.json({ ok: true });
}
