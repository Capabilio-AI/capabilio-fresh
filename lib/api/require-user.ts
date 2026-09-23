import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Every assessment route needs a signed-in student — this is the shared gate. */
export async function requireUser(
  supabase: SupabaseClient<Database>
): Promise<{ userId: string } | { error: NextResponse }> {
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { error: NextResponse.json({ error: "Not authenticated" }, { status: 401 }) };
  }
  return { userId: user.id };
}
