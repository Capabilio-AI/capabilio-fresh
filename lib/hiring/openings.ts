import { untyped } from "@/lib/org/db";
import type { createServiceClient } from "@/lib/supabase/service";
import { isAccepting } from "./format";
import type { OpeningInput } from "./schema";
import type { ApplicationRow, ApplicationStatus, Opening } from "./types";

type Service = ReturnType<typeof createServiceClient>;

interface OpeningDb {
  id: string;
  slug: string;
  title: string;
  team: string;
  location: string;
  work_mode: Opening["workMode"];
  employment_type: Opening["employmentType"];
  summary: string;
  about: string;
  responsibilities: string[];
  requirements: string[];
  nice_to_have: string[];
  proof_brief: string | null;
  day_to_day: string | null;
  first_months: string[] | null;
  interview: Opening["interview"] | null;
  compensation: string | null;
  status: Opening["status"];
  published_at: string | null;
  closes_on: string | null;
  created_at: string;
  updated_at: string;
}

interface ApplicationDb {
  id: string;
  opening_id: string | null;
  full_name: string;
  email: string;
  work_url: string;
  proof_note: string;
  resume_url: string | null;
  profile_url: string | null;
  status: ApplicationStatus;
  internal_note: string | null;
  created_at: string;
  job_openings: { title: string } | null;
}

/** Pure. */
export function toOpening(r: OpeningDb): Opening {
  return {
    id: r.id,
    slug: r.slug,
    title: r.title,
    team: r.team,
    location: r.location,
    workMode: r.work_mode,
    employmentType: r.employment_type,
    summary: r.summary,
    about: r.about,
    responsibilities: r.responsibilities ?? [],
    requirements: r.requirements ?? [],
    niceToHave: r.nice_to_have ?? [],
    proofBrief: r.proof_brief,
    dayToDay: r.day_to_day,
    firstMonths: r.first_months ?? [],
    interview: Array.isArray(r.interview) ? r.interview : [],
    compensation: r.compensation,
    status: r.status,
    publishedAt: r.published_at,
    closesOn: r.closes_on,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  };
}

/** Pure. snake_case columns for an insert or update; only the keys that were sent. */
export function toColumns(input: Partial<OpeningInput>): Record<string, unknown> {
  const map: Record<string, unknown> = {
    title: input.title,
    slug: input.slug,
    team: input.team,
    location: input.location,
    work_mode: input.workMode,
    employment_type: input.employmentType,
    summary: input.summary,
    about: input.about,
    responsibilities: input.responsibilities,
    requirements: input.requirements,
    nice_to_have: input.niceToHave,
    proof_brief: input.proofBrief === "" ? null : input.proofBrief,
    day_to_day: input.dayToDay === "" ? null : input.dayToDay,
    first_months: input.firstMonths,
    interview: input.interview,
    compensation: input.compensation === "" ? null : input.compensation,
    status: input.status,
    closes_on: input.closesOn,
  };
  return Object.fromEntries(Object.entries(map).filter(([, v]) => v !== undefined));
}

const OPENING_COLS =
  "id, slug, title, team, location, work_mode, employment_type, summary, about, responsibilities, requirements, nice_to_have, proof_brief, day_to_day, first_months, interview, compensation, status, published_at, closes_on, created_at, updated_at";

/**
 * Roles shown on /careers: open, and not past their closing date.
 * A failed read (for example before the careers migration is applied) shows "nothing open", never an error page.
 */
export async function listPublicOpenings(service: Service): Promise<Opening[]> {
  const { data, error } = await untyped(service).from("job_openings").select(OPENING_COLS).in("status", ["open", "soon"]).order("published_at", { ascending: false, nullsFirst: false });
  if (error) {
    console.error("[careers] could not list openings:", error.message);
    return [];
  }
  const roles = ((data ?? []) as OpeningDb[]).map(toOpening).filter((o) => o.status === "soon" || isAccepting(o));
  // roles taking applications first, then the ones opening soon
  return [...roles.filter((o) => o.status === "open"), ...roles.filter((o) => o.status === "soon")];
}

/** A role by link name. Drafts are never public; a closed role still resolves so a shared link says it closed instead of 404ing. */
export async function getPublicOpening(service: Service, slug: string): Promise<Opening | null> {
  const { data, error } = await untyped(service).from("job_openings").select(OPENING_COLS).eq("slug", slug).in("status", ["open", "soon", "closed"]).maybeSingle();
  if (error) {
    console.error("[careers] could not read opening:", error.message);
    return null;
  }
  return data ? toOpening(data as OpeningDb) : null;
}

export async function listAllOpenings(service: Service): Promise<Opening[]> {
  const { data } = await untyped(service).from("job_openings").select(OPENING_COLS).order("created_at", { ascending: false });
  return ((data ?? []) as OpeningDb[]).map(toOpening);
}

export async function listApplications(service: Service): Promise<ApplicationRow[]> {
  const { data } = await untyped(service)
    .from("job_applications")
    .select("id, opening_id, full_name, email, work_url, proof_note, resume_url, profile_url, status, internal_note, created_at, job_openings(title)")
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as unknown as ApplicationDb[]).map((a) => ({
    id: a.id,
    openingId: a.opening_id,
    openingTitle: a.job_openings?.title ?? null,
    fullName: a.full_name,
    email: a.email,
    workUrl: a.work_url,
    proofNote: a.proof_note,
    resumeUrl: a.resume_url,
    profileUrl: a.profile_url,
    status: a.status,
    internalNote: a.internal_note,
    createdAt: a.created_at,
  }));
}
