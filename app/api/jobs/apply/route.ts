import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { passportUrl } from "@/lib/passport/url";
import { isAccepting } from "@/lib/hiring/format";

const Body = z.object({ openingId: z.string().uuid(), proofNote: z.string().trim().min(40, "Write a few lines on why you are a fit.").max(2000) }).strict();
const WINDOW_SECONDS = 10 * 60;
const MAX_PER_WINDOW = 10;

/** A signed-in student applies to a COMPANY role. Their name, email and Skill Passport come from their account, never from the request. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "jobs-apply", maxRequests: MAX_PER_WINDOW, windowSeconds: WINDOW_SECONDS });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining, WINDOW_SECONDS);

  const body = Body.safeParse(await request.json().catch(() => null));
  if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const service = createServiceClient();
  const db = untyped(service);
  const [opening, profile, user] = await Promise.all([
    db.from("job_openings").select("status, closes_on, institution_id").eq("id", body.data.openingId).maybeSingle(),
    db.from("profiles").select("full_name, passport_code").eq("id", auth.userId).maybeSingle(),
    supabase.auth.getUser(),
  ]);
  const role = opening.data as { status: "open"; closes_on: string | null; institution_id: string | null } | null;
  if (!role || !role.institution_id || !isAccepting({ status: role.status, closesOn: role.closes_on })) return NextResponse.json({ error: "This role is no longer taking applications." }, { status: 409 });
  const email = user.data.user?.email;
  const fullName = (profile.data as { full_name: string | null } | null)?.full_name?.trim();
  const code = (profile.data as { passport_code: string } | null)?.passport_code;
  if (!email || !fullName || !code) return NextResponse.json({ error: "Finish your profile (name) before applying." }, { status: 409 });

  const { error } = await db.from("job_applications").insert({
    opening_id: body.data.openingId,
    user_id: auth.userId,
    full_name: fullName,
    email,
    work_url: await passportUrl(code),
    proof_note: body.data.proofNote,
  });
  if (error?.code === "23505") return NextResponse.json({ error: "You have already applied to this role." }, { status: 409 });
  if (error) {
    console.error("[jobs] could not save application:", error.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
