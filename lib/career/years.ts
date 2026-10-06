export const MAX_PROGRAM_YEARS = 8;
const MAX_YEARS_AGO_STARTED = 10;

export type YearsResult = { ok: true; startYear: number; endYear: number } | { ok: false; message: string };

/** Shared by the signup form and the server routes; mirrors the checks in the handle_new_user trigger. */
export function validateProgramYears(start: unknown, end: unknown, now: Date = new Date()): YearsResult {
  const s = typeof start === "string" ? Number(start.trim()) : start;
  const e = typeof end === "string" ? Number(end.trim()) : end;
  if (!Number.isInteger(s) || !Number.isInteger(e)) return { ok: false, message: "Enter both years as 4-digit numbers." };
  const startYear = s as number;
  const endYear = e as number;
  const thisYear = now.getFullYear();
  if (startYear < thisYear - MAX_YEARS_AGO_STARTED || startYear > thisYear + 1) {
    return { ok: false, message: "Start year looks wrong — check it and try again." };
  }
  if (endYear <= startYear) return { ok: false, message: "End year must be after start year." };
  if (endYear - startYear > MAX_PROGRAM_YEARS) return { ok: false, message: `A program can't run longer than ${MAX_PROGRAM_YEARS} years.` };
  return { ok: true, startYear, endYear };
}

/** Program length in years for planning (roadmap milestones): from the start and end years, 4 when either is missing or implausible, bounded 2–6. */
export function programLengthYears(startYear: number | null, endYear: number | null): number {
  if (startYear == null || endYear == null || endYear <= startYear) return 4;
  return Math.min(6, Math.max(2, endYear - startYear));
}
