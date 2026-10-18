// Transactional email through Resend's HTTP API (no SDK). Needs RESEND_API_KEY and EMAIL_FROM
// (e.g. "Capabilio <invites@your-verified-domain>"). When either is missing nothing is sent and the caller falls back
// to sharing a link by hand, so a missing key never breaks the feature it supports.

export type EmailResult = { sent: true } | { sent: false; reason: "not_configured" | "failed" };

export interface OutgoingEmail {
  to: string;
  subject: string;
  html: string;
  text: string;
}

export function isEmailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY && process.env.EMAIL_FROM);
}

export async function sendEmail(mail: OutgoingEmail): Promise<EmailResult> {
  const key = process.env.RESEND_API_KEY;
  const from = process.env.EMAIL_FROM;
  if (!key || !from) return { sent: false, reason: "not_configured" };
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
      body: JSON.stringify({ from, to: [mail.to], subject: mail.subject, html: mail.html, text: mail.text }),
      signal: AbortSignal.timeout(10_000),
    });
    if (!res.ok) {
      console.error(`[email] Resend rejected the message (${res.status}): ${(await res.text().catch(() => "")).slice(0, 300)}`);
      return { sent: false, reason: "failed" };
    }
    return { sent: true };
  } catch (e) {
    console.error("[email] send failed:", e instanceof Error ? e.message : e);
    return { sent: false, reason: "failed" };
  }
}
