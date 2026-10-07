import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Every assessment route needs a signed-in student — this is the shared gate. */
export async function requireUser(
  supabase: SupabaseClient<Database>
): Promise<{ userId: string } | { error: NextResponse }> {
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  if (!userId) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { userId };
}
