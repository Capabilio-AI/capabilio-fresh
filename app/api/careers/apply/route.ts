import { NextResponse, after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { ipRateLimitKey } from "@/lib/rate-limit/ip";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { sendEmail } from "@/lib/email/send";
import { ApplySchema } from "@/lib/hiring/schema";
import { isAccepting } from "@/lib/hiring/format";

const WINDOW_SECONDS = 10 * 60;
const MAX_PER_WINDOW = 6;

const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Public, no login. An application is a link to real work plus a few lines; a resume is optional. A repeat from the same email gets the same success answer. */
export async function POST(request: Request) {
  const limit = await checkRateLimit(ipRateLimitKey(request), { bucket: "careers-apply", maxRequests: MAX_PER_WINDOW, windowSeconds: WINDOW_SECONDS });
  if (!limit.allowed) return NextResponse.json({ error: "Too many requests. Please try again in a few minutes." }, { status: 429 });

  const parsed = ApplySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { openingId, fullName, email, workUrl, proofNote, resumeUrl, profileUrl } = parsed.data;

  const db = untyped(createServiceClient());
  let roleTitle = "Open introduction";
  if (openingId) {
    const { data } = await db.from("job_openings").select("title, status, closes_on").eq("id", openingId).maybeSingle();
    const open = data && isAccepting({ status: data.status, closesOn: data.closes_on });
    if (!open) return NextResponse.json({ error: "This role is no longer taking applications." }, { status: 409 });
    roleTitle = data.title as string;
  }

  const { error } = await db.from("job_applications").insert({
    opening_id: openingId,
    full_name: fullName,
    email,
    work_url: workUrl,
    proof_note: proofNote,
    resume_url: resumeUrl || null,
    profile_url: profileUrl || null,
  });
  // 23505 = this email already applied to this role: same success answer, so the form cannot be used to probe who applied.
  if (error && error.code === "23505") return NextResponse.json({ ok: true });
  if (error) {
    console.error("[careers] could not save application:", error.message);
    return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  }

  const notify = process.env.CAREERS_NOTIFY_EMAIL;
  if (notify) {
    after(() =>
      sendEmail({
        to: notify,
        subject: `New application: ${roleTitle} — ${fullName}`,
        text: `${fullName} <${email}> applied for ${roleTitle}.\n\nWork: ${workUrl}\n\n${proofNote}\n\nResume: ${resumeUrl || "-"}\nProfile: ${profileUrl || "-"}`,
        html: `<p><b>${escapeHtml(fullName)}</b> &lt;${escapeHtml(email)}&gt; applied for <b>${escapeHtml(roleTitle)}</b>.</p><p>Work: ${escapeHtml(workUrl)}</p><p style="white-space:pre-wrap">${escapeHtml(proofNote)}</p><p>Resume: ${escapeHtml(resumeUrl || "-")}<br>Profile: ${escapeHtml(profileUrl || "-")}</p>`,
      }),
    );
  }
  return NextResponse.json({ ok: true });
}
