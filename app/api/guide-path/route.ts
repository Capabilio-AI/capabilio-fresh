import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { getGuidePaths } from "@/lib/guide-path/read";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { primary, planB } = await getGuidePaths(supabase, auth.userId);
  return NextResponse.json({ primary, planB });
}
