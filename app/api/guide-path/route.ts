import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { data, error } = await supabase
    .from("guide_paths")
    .select("target_career, is_primary, phases, version, generated_at")
    .eq("user_id", auth.userId)
    .order("is_primary", { ascending: false });
  if (error) throw error;

  const primary = data?.find((p) => p.is_primary) ?? null;
  const planB = data?.find((p) => !p.is_primary) ?? null;
  return NextResponse.json({ primary, planB });
}
