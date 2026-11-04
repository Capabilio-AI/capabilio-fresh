import { NextResponse, after } from "next/server";
import { z } from "zod";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { clientIp, ipRateLimitKey } from "@/lib/rate-limit/ip";
import { checkRateLimit } from "@/lib/rate-limit/check";
import { sendEmail } from "@/lib/email/send";
import { CONTACT_EMAIL } from "@/lib/site";

const TOPICS = { student: "Student", college: "College or university", company: "Company", other: "Something else" } as const;

const ContactSchema = z
  .object({
    fullName: z.string().trim().min(2, "Enter your name.").max(120),
    email: z.string().trim().email("Enter a valid email address.").max(254),
    topic: z.enum(["student", "college", "company", "other"]),
    message: z.string().trim().min(10, "Tell us a little more (at least 10 characters).").max(2000, "Please keep it under 2000 characters."),
    website: z.string().max(500).optional(), // honeypot: real people never see or fill this
  })
  .strict();

const WINDOW_MS = 10 * 60 * 1000;
const MAX_PER_WINDOW = 5;
const hits = new Map<string, number[]>();
function allowed(key: string, now = Date.now()): boolean {
  const recent = (hits.get(key) ?? []).filter((t) => now - t < WINDOW_MS);
  if (recent.length >= MAX_PER_WINDOW) {
    hits.set(key, recent);
    return false;
  }
  hits.set(key, [...recent, now]);
  return true;
}
const escapeHtml = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** Public contact form: saves the message, then emails it to the team (CONTACT_NOTIFY_EMAIL, default info@). A bot that fills the honeypot gets the same success answer. */
export async function POST(request: Request) {
  const dbLimit = await checkRateLimit(ipRateLimitKey(request), { bucket: "contact", maxRequests: MAX_PER_WINDOW, windowSeconds: WINDOW_MS / 1000 });
  if (!dbLimit.allowed || !allowed(clientIp(request))) return NextResponse.json({ error: "Too many messages. Please try again in a few minutes." }, { status: 429 });

  const parsed = ContactSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
  const { fullName, email, topic, message, website } = parsed.data;
  if (website) return NextResponse.json({ ok: true });

  const { error } = await untyped(createServiceClient()).from("contact_messages").insert({ full_name: fullName, email, topic, message });
  if (error) {
    console.error("[contact] could not save message:", error.message);
    return NextResponse.json({ error: "Something went wrong. Please try again, or email us directly." }, { status: 500 });
  }

  after(async () => {
    const sent = await sendEmail({
      to: process.env.CONTACT_NOTIFY_EMAIL || CONTACT_EMAIL,
      subject: `Contact (${TOPICS[topic]}): ${fullName}`,
      text: `${fullName} <${email}>\nTopic: ${TOPICS[topic]}\n\n${message}`,
      html: `<p><b>${escapeHtml(fullName)}</b> &lt;${escapeHtml(email)}&gt;<br>Topic: ${TOPICS[topic]}</p><p style="white-space:pre-wrap">${escapeHtml(message)}</p>`,
    });
    if (!sent.sent) console.warn(`[contact] saved, but the notification email was not sent (${sent.reason}). Read it in the contact_messages table.`);
  });
  return NextResponse.json({ ok: true });
}
