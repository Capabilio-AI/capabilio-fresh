/** Pure rules of the admin portal: who counts as what, what a decision needs, and what the user is told. No database, so all of it is tested. */

export type PersonKind = "student" | "graduate" | "professional" | "other";

/** profiles.student_status names the path; anything else (including no value) is "other". */
export function kindOfProfile(status: string | null | undefined): PersonKind {
  return status === "student" || status === "graduate" || status === "professional" ? status : "other";
}

/** Membership roles that run an organisation and need Capabilio's approval before they are active. */
export const ORG_ROLES = ["principal", "vice_principal", "hod", "tpo", "faculty", "ceo", "company_admin"] as const;
export const isOrgRole = (role: string): boolean => (ORG_ROLES as readonly string[]).includes(role);
export const ROLE_LABEL: Record<string, string> = {
  principal: "Principal", vice_principal: "Vice principal", hod: "Head of department", tpo: "Training & placement officer",
  faculty: "Faculty", ceo: "CEO", company_admin: "Company admin", student: "Student", mentor: "Mentor", professional: "Professional",
};

export type Decision = "approved" | "rejected" | "hold";
export const MIN_REASON = 10;
export const MAX_REASON = 500;

export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

/** A rejection must tell the user why (they see it on their profile and by email); a hold should say what is awaited; an approval needs no reason. */
export function checkDecision(input: { decision: unknown; reason: unknown }): Checked<{ decision: Decision; reason: string | null }> {
  const decision = input.decision;
  if (decision !== "approved" && decision !== "rejected" && decision !== "hold") return { ok: false, error: "Choose approve, reject or hold." };
  const reason = typeof input.reason === "string" ? input.reason.replace(/\s+/g, " ").trim() : "";
  if (reason.length > MAX_REASON) return { ok: false, error: `Keep the reason under ${MAX_REASON} characters.` };
  if (decision === "rejected" && reason.length < MIN_REASON) return { ok: false, error: `Say why it is rejected (at least ${MIN_REASON} characters). The user sees this.` };
  if (decision === "hold" && reason.length < 5) return { ok: false, error: "Say what is needed before this can move on, so the user knows." };
  return { ok: true, value: { decision, reason: reason || null } };
}

const escapeHtml = (s: string) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] as string);

export interface Notice { title: string; body: string; emailSubject: string; text: string; html: string }

/** What the user is told, in the app and by email. The reason is theirs to read, so it is quoted exactly. */
export function decisionNotice(input: { subject: string; decision: Decision; reason: string | null; name?: string | null }): Notice {
  const { subject, decision, reason } = input;
  const hi = input.name ? `Hi ${input.name.split(" ")[0]},` : "Hello,";
  const head = decision === "approved" ? `${subject}: approved` : decision === "rejected" ? `${subject}: not approved` : `${subject}: on hold`;
  const lead = decision === "approved"
    ? `Your ${subject.toLowerCase()} has been approved by the Capabilio team.`
    : decision === "rejected"
      ? `Your ${subject.toLowerCase()} was not approved.`
      : `Your ${subject.toLowerCase()} is on hold while we check a few things.`;
  const why = reason ? (decision === "approved" ? `Note from the team: ${reason}` : `Reason: ${reason}`) : "";
  const next = decision === "rejected" ? "You can fix what is listed and apply again, or reply to this email if you think we got it wrong." : decision === "hold" ? "We will update you as soon as it is cleared." : "You can use it straight away.";
  const text = [hi, "", lead, why, next, "", "Capabilio AI"].filter((l, i, a) => l !== "" || (a[i - 1] !== "" && i > 0)).join("\n");
  const html = `<p>${escapeHtml(hi)}</p><p>${escapeHtml(lead)}</p>${why ? `<p style="border-left:3px solid #ff5701;padding-left:12px">${escapeHtml(why)}</p>` : ""}<p>${escapeHtml(next)}</p><p>Capabilio AI</p>`;
  return { title: head, body: [lead, why].filter(Boolean).join(" ").slice(0, 300), emailSubject: head, text, html };
}

/** "3 days ago" style age for queues. */
export function ageLabel(iso: string, now: Date = new Date()): string {
  const mins = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 60_000));
  if (mins < 60) return `${mins}m`;
  if (mins < 60 * 24) return `${Math.round(mins / 60)}h`;
  return `${Math.round(mins / 1440)}d`;
}

/** A request is stale after this many days with no decision. */
export const STALE_DAYS = 3;
export const isStale = (iso: string, now: Date = new Date()): boolean => now.getTime() - new Date(iso).getTime() > STALE_DAYS * 86_400_000;

/** Days (YYYY-MM-DD) for the last `n` days ending today, oldest first, for trend charts. */
export function lastDays(n: number, now: Date = new Date()): string[] {
  return Array.from({ length: n }, (_, i) => new Date(now.getTime() - (n - 1 - i) * 86_400_000).toISOString().slice(0, 10));
}

/** Counts rows per day for the given days; days with none are 0. */
export function perDay(isoDates: readonly string[], days: readonly string[]): number[] {
  const by = new Map<string, number>();
  for (const d of isoDates) { const k = d.slice(0, 10); by.set(k, (by.get(k) ?? 0) + 1); }
  return days.map((d) => by.get(d) ?? 0);
}

/** One CSV cell, quoted when needed, and neutralised when a spreadsheet could read it as a formula. */
export function csvCell(v: unknown): string {
  let s = v == null ? "" : String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}
export const toCsv = (header: readonly string[], rows: readonly (readonly unknown[])[]): string => [header, ...rows].map((r) => r.map(csvCell).join(",")).join("\n");
