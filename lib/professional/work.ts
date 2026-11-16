/** One job in a professional's history, as the pages show it. `entered` came from their own entry, `resume` from the resume they uploaded. */
import { experienceMonths } from "./experience";

export interface WorkEntry { id: string; title: string; organisation: string; period: string; description: string | null; current: boolean; source: "entered" | "resume"; /** Months in this job when its dates are known, otherwise 0. */ months: number }

/** A row of `pro_employment`. */
export interface ProEmploymentRow {
  id: string;
  employer_name: string;
  job_title: string;
  start_date: string | null;
  end_date: string | null;
  period_text: string | null;
  description: string | null;
  source: "entered" | "resume";
}

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const monthYear = (iso: string) => `${MONTHS[Number(iso.slice(5, 7)) - 1]} ${iso.slice(0, 4)}`;

/** "Aug 2023 to present", "Jan 2019 to Mar 2022", or "Dates not added" when there is no start. */
export function periodOf(start: string | null, end: string | null): string {
  if (!start) return "Dates not added";
  return `${monthYear(start)} to ${end ? monthYear(end) : "present"}`;
}

/** A job with no end date is the current one: entered by hand, or read from a resume that gave a start date and said it is still held. */
const isCurrent = (r: ProEmploymentRow) => r.end_date === null && (r.source === "entered" || r.start_date !== null);

/** Current job first, then dated jobs newest first, then jobs known only from the resume's own wording. */
export function workFromRows(rows: readonly ProEmploymentRow[]): WorkEntry[] {
  const rank = (r: ProEmploymentRow) => (isCurrent(r) ? 0 : r.start_date ? 1 : 2);
  return [...rows]
    .sort((a, b) => rank(a) - rank(b) || (b.start_date ?? "").localeCompare(a.start_date ?? ""))
    .map((r) => ({
      id: r.id,
      title: r.job_title,
      organisation: r.employer_name,
      period: r.start_date ? periodOf(r.start_date, r.end_date) : (r.period_text ?? "Dates not added"),
      description: r.description,
      current: isCurrent(r),
      source: r.source,
      months: experienceMonths([r]),
    }));
}
