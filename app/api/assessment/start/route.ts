import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { startOrResumeAttempt, getAttemptProgress } from "@/lib/assessment/attempts";

export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const attempt = await startOrResumeAttempt(supabase, auth.userId);
  const progress = await getAttemptProgress(supabase, attempt.id);

  return NextResponse.json(progress);
}
