import type { OutgoingEmail } from "./send";

const esc = (s: string) => s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The staff invitation. Every value that came from a person is escaped; the link is built by the server. */
export function staffInviteEmail(p: { to: string; institutionName: string; roleLabel: string; inviterName: string | null; url: string; expiresOn: string }): OutgoingEmail {
  const by = p.inviterName ? `${p.inviterName} has invited you` : "You have been invited";
  const subject = `You're invited to join ${p.institutionName} on Capabilio`;
  const text = `${by} to join ${p.institutionName} on Capabilio as ${p.roleLabel}.\n\nOpen this link to create your account (it works once, for the address ${p.to}, until ${p.expiresOn}):\n${p.url}\n\nIf you weren't expecting this, you can ignore this email.`;
  const html = `<div style="font-family:system-ui,sans-serif;max-width:520px;margin:0 auto;color:#1a1a1a">
<h2 style="margin:0 0 12px">Join ${esc(p.institutionName)} on Capabilio</h2>
<p>${esc(by)} to join <strong>${esc(p.institutionName)}</strong> as <strong>${esc(p.roleLabel)}</strong>.</p>
<p><a href="${esc(p.url)}" style="display:inline-block;background:#f26a1b;color:#fff;padding:10px 18px;border-radius:8px;text-decoration:none;font-weight:600">Create your account</a></p>
<p style="font-size:13px;color:#555">The link works once, only for ${esc(p.to)}, until ${esc(p.expiresOn)}. If the button doesn't work, paste this into your browser:<br>${esc(p.url)}</p>
<p style="font-size:12px;color:#888">If you weren't expecting this, you can ignore this email.</p></div>`;
  return { to: p.to, subject, html, text };
}
