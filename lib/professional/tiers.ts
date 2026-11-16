import type { VerificationTier } from "./types";

export const TIER_LABEL: Record<VerificationTier, string> = {
  epfo: "EPFO verified",
  work_email: "Work email verified",
  payslip: "Payslip verified",
  colleague: "Colleague confirmed",
  self_claimed: "Self-claimed",
};

/** What each check actually means, in the words the person sees under a role. */
export const TIER_HOW: Record<VerificationTier, string> = {
  epfo: "Matched against your EPFO employment history. Only employer, dates and the result were kept.",
  work_email: "Confirmed with a code sent to your company email address.",
  payslip: "Read from a payslip or Form 16. The amounts were discarded.",
  colleague: "A former colleague on Capabilio confirmed you worked there at the same time.",
  self_claimed: "Taken from your resume. Nothing has checked it yet.",
};

/** The three checks that count toward mentoring. */
export const isVerifiedTier = (t: VerificationTier) => t === "epfo" || t === "work_email" || t === "payslip";

const MS_MONTH = 30.4375 * 86_400_000;
/** "5y 3m" for a role's length. */
export function spanLabel(start: string, end: string | null, now: Date = new Date()): string {
  const months = Math.max(0, Math.round(((end ? Date.parse(end) : now.getTime()) - Date.parse(start)) / MS_MONTH));
  const y = Math.floor(months / 12);
  const m = months % 12;
  return [y ? `${y}y` : "", m || !y ? `${m}m` : ""].filter(Boolean).join(" ");
}

export const monthYear = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { month: "short", year: "numeric", timeZone: "UTC" });
