import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { requireUser } from "@/lib/api/require-user";
import { getOrgContext, type OrgContext } from "@/lib/org/context";

/** The caller must be an ACTIVE company admin; everything they touch is then scoped to ctx.institutionId, never to a request field. */
export async function requireCompany(supabase: SupabaseClient<Database>): Promise<{ ctx: OrgContext } | { error: NextResponse }> {
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth;
  const ctx = await getOrgContext(supabase, auth.userId);
  if (!ctx || ctx.kind !== "company") return { error: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  return { ctx };
}
