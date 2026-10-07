import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requirePlatformAdmin } from "@/lib/arena-content/admin-gate";

/** The stored spec, for editing. Contains hidden answers: admin only. */
export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const auth = await requirePlatformAdmin(await createClient());
  if ("error" in auth) return auth.error;
  const { data } = await untyped(createServiceClient()).from("arena_challenges").select("spec").eq("id", (await params).id).is("user_id", null).maybeSingle();
  return data?.spec ? NextResponse.json({ spec: data.spec }) : NextResponse.json({ error: "No spec stored for this challenge." }, { status: 404 });
}
