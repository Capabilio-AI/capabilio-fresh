import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";
import { verifiedNext } from "@/lib/onboarding/auth-path";
import { ipRateLimitKey } from "@/lib/rate-limit/ip";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { OrgSignupSchema, registerOrganisation } from "@/lib/org/signup";

/** Organisation signup. Role, org type handling and pending status are decided here, never by the browser. */
export async function POST(request: Request) {
  // sends a verification email to an arbitrary address, so throttle per IP (DB-backed; effective once migration 143 is applied)
  const limit = await checkRateLimit(ipRateLimitKey(request), { bucket: "org_signup", maxRequests: 5, windowSeconds: 3600, failClosed: true } /* sends a verification email, so a limiter outage must not become an open relay */);
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const parsed = OrgSignupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const auth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const origin = new URL(request.url).origin;
  const result = await registerOrganisation(auth, createServiceClient(), parsed.data, `${origin}/auth/confirm?next=${encodeURIComponent(verifiedNext("organisation"))}`);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, orgType: parsed.data.orgType });
}
