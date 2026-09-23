import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { getAttemptProgress } from "@/lib/assessment/attempts";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { data: attempt } = await supabase
    .from("assessment_attempts")
    .select("id")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!attempt) {
    return NextResponse.json({ error: "Assessment not started" }, { status: 404 });
  }

  const progress = await getAttemptProgress(supabase, attempt.id);
  return NextResponse.json(progress);
}
