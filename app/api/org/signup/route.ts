import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "@/lib/supabase/env";
import { createServiceClient } from "@/lib/supabase/service";
import { OrgSignupSchema, registerOrganisation } from "@/lib/org/signup";

/** Organisation signup. Role, org type handling and pending status are decided here, never by the browser. */
export async function POST(request: Request) {
  const parsed = OrgSignupSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  }

  const auth = createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, { auth: { persistSession: false, autoRefreshToken: false } });
  const origin = new URL(request.url).origin;
  const result = await registerOrganisation(auth, createServiceClient(), parsed.data, `${origin}/auth/confirm?next=/verified`);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, orgType: parsed.data.orgType });
}
