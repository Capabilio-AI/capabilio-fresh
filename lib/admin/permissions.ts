/** What each admin role may do. One table, used by the nav, every page and every API route, so a hidden button is never the only guard. */

export const ROLES = ["owner", "reviewer", "analyst", "support"] as const;
export type AdminRole = (typeof ROLES)[number];

export type Permission =
  | "view"       // the Overview and Activity numbers
  | "lists"      // browse colleges, people, professionals, companies, executives, the decision log
  | "lookup"     // find one person by name or email, a few results at a time
  | "contacts"   // see emails and phone numbers
  | "decide"     // approve, hold or reject
  | "export"     // download CSV files
  | "team";      // manage who can open the console

const MATRIX: Record<AdminRole, readonly Permission[]> = {
  owner: ["view", "lists", "lookup", "contacts", "decide", "export", "team"],
  reviewer: ["view", "lists", "lookup", "contacts", "decide"],
  analyst: ["view", "lists", "lookup", "contacts", "export"],
  support: ["lookup", "contacts"],
};

export interface AdminLimits { role: AdminRole; hideContacts: boolean }

/** An analyst can be told not to see contact details; that also takes away export, because a file would carry them. */
export function can(a: AdminLimits, p: Permission): boolean {
  if (!MATRIX[a.role].includes(p)) return false;
  if (a.hideContacts && (p === "contacts" || p === "export")) return false;
  return true;
}

export const isAdminRole = (v: unknown): v is AdminRole => typeof v === "string" && (ROLES as readonly string[]).includes(v);

export const ROLE_LABEL: Record<AdminRole, string> = { owner: "Owner", reviewer: "Reviewer", analyst: "Analyst", support: "Support" };
export const ROLE_SUMMARY: Record<AdminRole, string> = {
  owner: "Everything, including who can open the console.",
  reviewer: "Sees everyone and decides approvals. Cannot export data or manage the team.",
  analyst: "Read only: numbers, lists and exports. Cannot decide anything.",
  support: "Looks up one person at a time by name or email. No lists, no numbers, no exports.",
};

/** Roles that may change things through the older admin tools (Pulse moderation, careers, curriculum). */
export const canEditTools = (role: AdminRole): boolean => role === "owner" || role === "reviewer";

/** A support lookup must name someone; it never lists the whole directory. */
export const LOOKUP_MIN = 3;
export const LOOKUP_MAX = 10;

/** "asha@college.edu" becomes "a•••@c•••.edu": enough to tell two people apart, not enough to write to them. */
export function maskEmail(email: string | null | undefined): string {
  if (!email) return "—";
  const [user, domain = ""] = email.split("@");
  const dot = domain.lastIndexOf(".");
  const host = dot > 0 ? `${domain[0]}•••${domain.slice(dot)}` : "•••";
  return `${user[0] ?? ""}•••@${host}`;
}

/** The first step to land on for a role: support has no Overview, so it starts at the lookup. */
export const homeFor = (a: AdminLimits): string => (can(a, "view") ? "/admin" : "/admin/people");

/** A password an admin may set: long enough that guessing is not realistic, and not their own email. */
export function checkNewPassword(pw: string, email: string | null): { ok: true } | { ok: false; error: string } {
  if (pw.length < 12) return { ok: false, error: "Use at least 12 characters." };
  if (pw.length > 128) return { ok: false, error: "That is too long. Keep it under 128 characters." };
  if (email && pw.toLowerCase().includes(email.split("@")[0].toLowerCase()) && email.split("@")[0].length >= 4) return { ok: false, error: "Do not put your email name in the password." };
  if (!/[a-z]/i.test(pw) || !/\d/.test(pw)) return { ok: false, error: "Mix letters and at least one number." };
  return { ok: true };
}
