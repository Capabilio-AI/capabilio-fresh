import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { getLeaderboard } from "@/lib/arena/data";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const entries = await getLeaderboard(supabase, auth.userId);
  return NextResponse.json({ entries });
}
