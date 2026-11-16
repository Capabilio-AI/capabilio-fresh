export interface JobValue { employerName: string; jobTitle: string; start: string | null; end: string | null }
export type Checked<T> = { ok: true; value: T } | { ok: false; error: string };

const MONTH = /^(\d{4})-(0[1-9]|1[0-2])$/;
const text = (v: unknown, max: number): string => (typeof v === "string" ? v.replace(/\s+/g, " ").trim().slice(0, max + 1) : "");

/** A "yyyy-mm" month as the first day of that month, or null when it is not one or lies in the future. */
function monthStart(v: unknown, now: Date): string | null {
  if (typeof v !== "string") return null;
  const m = MONTH.exec(v);
  if (!m) return null;
  const year = Number(m[1]);
  if (year < 1960) return null;
  const first = new Date(Date.UTC(year, Number(m[2]) - 1, 1));
  return first.getTime() > now.getTime() ? null : `${m[1]}-${m[2]}-01`;
}

/** A job a professional adds: employer, title, a start month, and an end month unless it is their current job. */
export function validateJob(input: unknown, now: Date = new Date()): Checked<JobValue> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const employerName = text(i.employerName, 120);
  const jobTitle = text(i.jobTitle, 120);
  if (!employerName || employerName.length > 120) return { ok: false, error: "Tell us the employer (up to 120 characters)." };
  if (!jobTitle || jobTitle.length > 120) return { ok: false, error: "Tell us the job title (up to 120 characters)." };
  const start = monthStart(i.start, now);
  if (!start) return { ok: false, error: "Choose the month you started, not in the future." };
  if (i.current === true) return { ok: true, value: { employerName, jobTitle, start, end: null } };
  const end = monthStart(i.end, now);
  if (!end) return { ok: false, error: "Choose the month you left, or mark this as your current job." };
  if (end < start) return { ok: false, error: "The end month cannot be before the start month." };
  return { ok: true, value: { employerName, jobTitle, start, end } };
}

export interface AboutValue { headline: string | null; location: string | null; about: string | null }

/** The "about you" fields. Empty means cleared; too long is refused rather than cut. */
export function validateAbout(input: unknown): Checked<AboutValue> {
  const i = (input && typeof input === "object" ? input : {}) as Record<string, unknown>;
  const headline = text(i.headline, 160);
  const location = text(i.location, 120);
  const about = typeof i.about === "string" ? i.about.trim() : "";
  if (headline.length > 160) return { ok: false, error: "Keep the headline under 160 characters." };
  if (location.length > 120) return { ok: false, error: "Keep the location under 120 characters." };
  if (about.length > 1200) return { ok: false, error: "Keep the about text under 1,200 characters." };
  return { ok: true, value: { headline: headline || null, location: location || null, about: about || null } };
}
