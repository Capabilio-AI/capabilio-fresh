import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/lib/supabase/service";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { requireAdminApi } from "@/lib/admin/api-guard";
import { checkNewPassword } from "@/lib/admin/permissions";
import { audit } from "@/lib/admin/audit";
import { createClient } from "@/lib/supabase/server";

const Body = z.object({ current: z.string().min(1).max(200), next: z.string().min(1).max(200) }).strict();

/** An admin changes their own password. The current one is checked first, so a left-open browser cannot be used to take the account over. */
export async function POST(request: Request) {
  const guard = await requireAdminApi(null, { allowMustChange: true });
  if ("error" in guard) return guard.error;
  const { admin } = guard;
  const limit = await checkRateLimit(admin.userId, { bucket: "admin_password", maxRequests: 6, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: "Enter your current and your new password." }, { status: 400 });
  const { data: me } = await (await createClient()).auth.getUser();
  const email = me.user?.email ?? admin.email;
  if (!email) return NextResponse.json({ error: "Could not read your account." }, { status: 500 });
  const check = checkNewPassword(body.data.next, email);
  if (!check.ok) return NextResponse.json({ error: check.error }, { status: 400 });
  if (body.data.next === body.data.current) return NextResponse.json({ error: "Choose a password you have not used here." }, { status: 400 });

  // A throwaway client proves the current password without touching the signed-in session.
  const probe = createPlainClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error: wrong } = await probe.auth.signInWithPassword({ email, password: body.data.current });
  if (wrong) return NextResponse.json({ error: "Your current password is not right." }, { status: 400 });

  const svc = createServiceClient();
  const { data: user } = await svc.auth.admin.getUserById(admin.userId);
  const { error } = await svc.auth.admin.updateUserById(admin.userId, { password: body.data.next, user_metadata: { ...(user.user?.user_metadata ?? {}), must_change_password: false } });
  if (error) return NextResponse.json({ error: "Could not change the password. Try again." }, { status: 500 });
  await audit(admin.userId, "account.password", email, null);
  return NextResponse.json({ ok: true });
}
