import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { requireUser } from "@/lib/api/require-user";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin } from "./store";

/** The caller must be a Capabilio (platform) admin: a row in platform_admins, managed by operators, not by any request. */
export async function requirePlatformAdmin(supabase: SupabaseClient<Database>): Promise<{ userId: string } | { error: NextResponse }> {
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth;
  if (!(await isPlatformAdmin(createServiceClient(), auth.userId))) return { error: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  return auth;
}
