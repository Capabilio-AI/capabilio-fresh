import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { can, type Permission } from "./permissions";
import { loadAdmin, type Admin } from "./db";

/** API guard: a signed-in Capabilio admin whose role has this permission, or the response to send back. */
export async function requireAdminApi(permission: Permission | null, opts: { allowMustChange?: boolean } = {}): Promise<{ admin: Admin } | { error: NextResponse }> {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth;
  const admin = await loadAdmin(auth.userId, null);
  if (!admin) return { error: NextResponse.json({ error: "Not allowed." }, { status: 403 }) };
  if (admin.mustChangePassword && !opts.allowMustChange) return { error: NextResponse.json({ error: "Choose your own password first." }, { status: 403 }) };
  if (permission && !can(admin, permission)) return { error: NextResponse.json({ error: "Your role cannot do that." }, { status: 403 }) };
  return { admin };
}
