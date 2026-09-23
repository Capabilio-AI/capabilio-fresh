import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { matchCareersForStudent } from "@/lib/career/match";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const matches = await matchCareersForStudent(supabase, auth.userId);
  return NextResponse.json({ matches });
}
