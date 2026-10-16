const IST = "Asia/Kolkata";
const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

/** Day, month (1-12) and year of an instant in Indian time. Months are named here, not by the locale, so every one has a three-letter name. */
function istParts(d: Date): { day: string; month: string; year: string } {
  const parts = new Intl.DateTimeFormat("en-GB", { day: "numeric", month: "numeric", year: "numeric", timeZone: IST }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  return { day: get("day"), month: MONTHS[Number(get("month")) - 1] ?? "", year: get("year") };
}

/** "16 Oct 2026", in the student's own calendar (India), or null when the evidence has no date. */
export function shortDate(iso: string | null | undefined): string | null {
  if (!iso) return null;
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return null;
  const p = istParts(d);
  return `${p.day} ${p.month} ${p.year}`;
}

/** The two engraved lines on the back of a badge: "16 OCT" over "2026". */
export function engravedDate(iso: string | null | undefined): { line1: string; line2: string } {
  const d = iso ? new Date(iso) : null;
  if (!d || Number.isNaN(d.getTime())) return { line1: "DATE NOT", line2: "RECORDED" };
  const p = istParts(d);
  return { line1: `${p.day} ${p.month}`.toUpperCase(), line2: p.year };
}

/** How long ago, in words a student would say. */
export function ago(iso: string | null | undefined, now: Date = new Date()): string | null {
  if (!iso) return null;
  const days = Math.floor((now.getTime() - new Date(iso).getTime()) / 86_400_000);
  if (!Number.isFinite(days) || days < 0) return null;
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months < 12 ? `${months} month${months === 1 ? "" : "s"} ago` : `${Math.floor(months / 12)} year${months >= 24 ? "s" : ""} ago`;
}
