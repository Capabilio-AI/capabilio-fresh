import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { requireUser } from "@/lib/api/require-user";
import { createServiceClient } from "@/lib/supabase/service";
import { isPlatformAdmin } from "./store";
import { untyped } from "@/lib/org/db";

/** The caller must be a Capabilio (platform) admin: a row in platform_admins, managed by operators, not by any request. */
export async function requirePlatformAdmin(supabase: SupabaseClient<Database>): Promise<{ userId: string } | { error: NextResponse }> {
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth;
  if (!(await isPlatformAdmin(createServiceClient(), auth.userId))) return { error: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  // Analysts and support staff look but do not change things through the older admin tools either (the role column exists from migration 205).
  const { data } = await untyped(createServiceClient()).from("platform_admins").select("role").eq("user_id", auth.userId).maybeSingle();
  const role = (data as { role?: string } | null)?.role;
  if (role === "analyst" || role === "support") return { error: NextResponse.json({ error: "Your role is read-only." }, { status: 403 }) };
  return auth;
}
