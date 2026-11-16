import { parsePeriod } from "./experience";
import type { ProResume } from "./resume-schema";

const clip = (s: string | null | undefined, max: number): string | null => {
  const t = s?.replace(/\s+/g, " ").trim();
  return t ? t.slice(0, max) : null;
};

const pad = (n: number) => String(n).padStart(2, "0");
const startOf = (p: string): string => (p.length === 4 ? `${p}-01-01` : `${p}-01`);
const endOf = (p: string): string => {
  if (p.length === 4) return `${p}-12-31`;
  const [y, m] = p.split("-").map(Number);
  return `${y}-${pad(m)}-${pad(new Date(Date.UTC(y, m, 0)).getUTCDate())}`;
};
const point = (pt: { year: number; month: number | null }): string => (pt.month ? `${pt.year}-${pad(pt.month)}` : String(pt.year));

export interface JobDates { start_date: string | null; end_date: string | null }

/**
 * The dates to store for a job. Dates are stored only when they tell a whole story: a start and an end, or a start and "still working here".
 * Anything half-known stays as the resume's own wording, so a past job is never mistaken for the current one.
 */
export function employmentDates(j: { startDate: string | null; endDate: string | null; current: boolean; period: string | null }): JobDates {
  let start = j.startDate;
  let end = j.endDate;
  let current = j.current;
  if (!start && j.period) {
    const p = parsePeriod(j.period);
    if (p) {
      start = point(p.start);
      if (p.end === "present") current = true;
      else if (p.end && !end) end = point(p.end);
    }
  }
  if (!start) return { start_date: null, end_date: null };
  const s = startOf(start);
  if (current) return { start_date: s, end_date: null };
  if (!end) return { start_date: null, end_date: null };
  const e = endOf(end);
  return e >= s ? { start_date: s, end_date: e } : { start_date: null, end_date: null };
}

export interface ProResumeRows {
  profile: { headline: string | null; about: string | null; location: string | null };
  employment: { employer_name: string; job_title: string; period_text: string | null; description: string | null; start_date: string | null; end_date: string | null }[];
}

/** What a resume adds to a professional's own tables. Only their own words; nothing is verified by reading a resume. */
export function proRowsFrom(x: ProResume): ProResumeRows {
  return {
    profile: { headline: clip(x.summary.headline, 160), about: clip(x.summary.about, 1200), location: clip(x.personal.location, 120) },
    employment: x.experience.map((e) => ({
      employer_name: clip(e.organisation, 120) ?? "Employer not stated",
      job_title: clip(e.title, 120) ?? "Role not stated",
      period_text: clip(e.period, 60),
      description: clip(e.description, 600),
      ...employmentDates(e),
    })),
  };
}
