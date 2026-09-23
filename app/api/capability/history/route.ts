import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";

export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const skill = new URL(request.url).searchParams.get("skill");

  let query = supabase
    .from("capability_history")
    .select("skill, capability_score, confidence, source, recorded_at")
    .eq("user_id", auth.userId)
    .order("recorded_at", { ascending: true });
  if (skill) query = query.eq("skill", skill);

  const { data, error } = await query;
  if (error) throw error;

  return NextResponse.json({ history: data ?? [] });
}
