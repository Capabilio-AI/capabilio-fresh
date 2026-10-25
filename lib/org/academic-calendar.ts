import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "./db";
import { branchKey } from "./branch-scope";

type Service = SupabaseClient<Database>;

export const ALL_BRANCHES = "*";
export const ALL_YEARS = 0;

export interface CalendarRow {
  branchKey: string;
  yearOfStudy: number;
  semester: 1 | 2;
  startsOn: string;
}

const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Enter a valid date.").refine((d) => !Number.isNaN(Date.parse(d)), "Enter a valid date.");

export const CalendarEntrySchema = z
  .object({
    branch: z.string().trim().min(1, "Choose a branch.").max(120),
    yearOfStudy: z.coerce.number().int().min(ALL_YEARS).max(6),
    semester: z.coerce.number().int().refine((n) => n === 1 || n === 2, "Semester must be 1 or 2."),
    startsOn: isoDate,
    endsOn: isoDate,
  })
  .strict()
  .refine((v) => v.endsOn > v.startsOn, { message: "The end date must be after the start date.", path: ["endsOn"] });
export type CalendarEntry = z.infer<typeof CalendarEntrySchema>;

/** The most specific row (branch and year beat "all") for each semester that applies to a student of this branch and year. */
function bestRowPerSemester(rows: readonly CalendarRow[], branch: string, yearOfStudy: number): Map<1 | 2, { score: number; startsOn: string }> {
  const key = branchKey(branch);
  const best = new Map<1 | 2, { score: number; startsOn: string }>();
  for (const r of rows) {
    const branchMatch = r.branchKey === key ? 2 : r.branchKey === ALL_BRANCHES ? 0 : -1;
    const yearMatch = r.yearOfStudy === yearOfStudy ? 1 : r.yearOfStudy === ALL_YEARS ? 0 : -1;
    if (branchMatch < 0 || yearMatch < 0) continue;
    const score = branchMatch + yearMatch;
    if (!best.has(r.semester) || score > best.get(r.semester)!.score) best.set(r.semester, { score, startsOn: r.startsOn });
  }
  return best;
}

/** Pure. When the college says semester 1 starts for a student of this branch and year (YYYY-MM-DD), or null when it has not said. */
export function firstSemesterStart(rows: readonly CalendarRow[], branch: string, yearOfStudy: number): string | null {
  return bestRowPerSemester(rows, branch, yearOfStudy).get(1)?.startsOn ?? null;
}

/**
 * Pure. The student's semester from the college's start dates: of the rows that apply to their branch and year, take the most specific per
 * semester, then the semester whose start date is the latest one already reached. null when nothing applies yet (callers fall back to an estimate).
 */
export function semesterFromCalendar(rows: readonly CalendarRow[], branch: string, yearOfStudy: number, now: Date): 1 | 2 | null {
  const best = bestRowPerSemester(rows, branch, yearOfStudy);
  const today = now.toISOString().slice(0, 10);
  const reached = [...best.entries()].filter(([, v]) => v.startsOn <= today).sort((a, b) => a[1].startsOn.localeCompare(b[1].startsOn));
  return reached.at(-1)?.[0] ?? null;
}

/** ponytail: only the start dates pick the semester (the latest one reached); end dates are recorded and shown for staff. Dates are not tied to an academic year, so staff re-enter them each cycle; stale dates keep the last reached semester. */
export async function loadCalendarRows(service: Service, institutionId: string): Promise<CalendarRow[]> {
  const { data } = await untyped(service).from("academic_calendar").select("branch_key, year_of_study, semester, starts_on").eq("institution_id", institutionId);
  return ((data ?? []) as { branch_key: string; year_of_study: number; semester: 1 | 2; starts_on: string }[]).map((r) => ({ branchKey: r.branch_key, yearOfStudy: r.year_of_study, semester: r.semester, startsOn: r.starts_on }));
}

export async function loadCalendarSemester(service: Service, institutionId: string, branch: string, yearOfStudy: number, now: Date): Promise<1 | 2 | null> {
  return semesterFromCalendar(await loadCalendarRows(service, institutionId), branch, yearOfStudy, now);
}

export interface CalendarListItem extends CalendarRow {
  endsOn: string;
  id: string;
  branch: string;
  updatedAt: string;
}

export async function listCalendar(service: Service, institutionId: string): Promise<CalendarListItem[]> {
  const { data } = await untyped(service).from("academic_calendar").select("id, branch, branch_key, year_of_study, semester, starts_on, ends_on, updated_at").eq("institution_id", institutionId).order("branch").order("year_of_study").order("semester");
  return ((data ?? []) as { id: string; branch: string; branch_key: string; year_of_study: number; semester: 1 | 2; starts_on: string; ends_on: string; updated_at: string }[]).map((r) => ({ id: r.id, branch: r.branch, branchKey: r.branch_key, yearOfStudy: r.year_of_study, semester: r.semester, startsOn: r.starts_on, endsOn: r.ends_on, updatedAt: r.updated_at }));
}

/** One semester's start and end dates for a branch (or all) and year (or all). Replaces the earlier date for the same slot. */
export async function saveCalendarEntry(service: Service, institutionId: string, userId: string, entry: CalendarEntry): Promise<void> {
  const allBranches = entry.branch === ALL_BRANCHES;
  const { error } = await untyped(service).from("academic_calendar").upsert(
    {
      institution_id: institutionId, branch: allBranches ? "All branches" : entry.branch.trim(), branch_key: allBranches ? ALL_BRANCHES : branchKey(entry.branch),
      year_of_study: entry.yearOfStudy, semester: entry.semester, starts_on: entry.startsOn, ends_on: entry.endsOn, updated_by: userId, updated_at: new Date().toISOString(),
    },
    { onConflict: "institution_id,branch_key,year_of_study,semester" }
  );
  if (error) throw error;
}
