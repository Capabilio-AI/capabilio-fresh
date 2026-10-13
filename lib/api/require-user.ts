import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { secondFactorPending } from "@/lib/supabase/aal";

/** Every assessment route needs a signed-in student — this is the shared gate. */
export async function requireUser(
  supabase: SupabaseClient<Database>
): Promise<{ userId: string } | { error: NextResponse }> {
  const { data } = await supabase.auth.getClaims();
  const userId = data?.claims?.sub;

  // A password-only session on a two-factor account is not signed in yet.
  if (!userId || (await secondFactorPending(supabase, data?.claims?.aal))) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { userId };
}
