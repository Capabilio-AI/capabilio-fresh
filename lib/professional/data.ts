import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import { ProResumeSchema, type ProResume } from "./resume-schema";
import { experienceMonths } from "./experience";
import { recordsFromResume } from "./records";
import { listRecords, type RecordLists, type Stored } from "./records-server";
import { workFromRows, type ProEmploymentRow, type WorkEntry } from "./work";

export interface ProfessionalData {
  name: string | null;
  avatarUrl: string | null;
  coverUrl: string | null;
  employer: string | null;
  jobTitle: string | null;
  resumeDone: boolean;
  headline: string | null;
  about: string | null;
  location: string | null;
  work: WorkEntry[];
  /** Months of experience across all jobs, overlap counted once. */
  experienceMonths: number;
  certifications: RecordLists["certifications"];
  projects: RecordLists["projects"];
  education: RecordLists["education"];
  links: RecordLists["links"];
  /** The record tables are available, so entries can be added and removed here. */
  recordsReady: boolean;
  /** Capabilio has approved this person as a mentor. */
  mentorApproved: boolean;
  /** The EPFO window: when it ends, and whether it has been passed. */
  /** Awards, honours and digital badges read from the resume. */
  awards: ProResume["awards"];
  languages: string[];
  verifyDeadline: string | null;
  epfoVerified: boolean;
}

/** Everything the professional pages show, from the professional's own tables (`pro_*`). The student and graduate tables are never read. */
export async function loadProfessional(userId: string): Promise<ProfessionalData> {
  const db = untyped(createServiceClient());
  const [account, profile, jobs, resume, verification, records, mentor] = await Promise.all([
    db.from("profiles").select("full_name, avatar_url, cover_url").eq("id", userId).maybeSingle(),
    db.from("pro_profiles").select("headline, about, location, employer_name, job_title").eq("user_id", userId).maybeSingle(),
    db.from("pro_employment").select("id, employer_name, job_title, start_date, end_date, period_text, description, source").eq("user_id", userId),
    db.from("pro_resumes").select("extraction, applied_at").eq("user_id", userId).maybeSingle(),
    db.from("pro_verification").select("status, window_ends_at").eq("user_id", userId).maybeSingle(),
    listRecords(userId).catch(() => null),
    db.from("mentor_profiles").select("status").eq("user_id", userId).maybeSingle(),
  ]);
  const p = (profile.data ?? {}) as { headline?: string | null; about?: string | null; location?: string | null; employer_name?: string | null; job_title?: string | null };
  const rows = (jobs.data ?? []) as ProEmploymentRow[];
  const r = resume.data as { extraction?: unknown; applied_at?: string | null } | null;
  const parsed = r?.extraction ? ProResumeSchema.safeParse(r.extraction) : null;
  const x = parsed?.success && parsed.data.isResume ? parsed.data : null;
  const v = verification.data as { status?: string; window_ends_at?: string } | null;
  const lists = records ?? fromResume(x);
  return {
    name: (account.data as { full_name?: string | null } | null)?.full_name ?? null,
    avatarUrl: (account.data as { avatar_url?: string | null } | null)?.avatar_url ?? null,
    coverUrl: (account.data as { cover_url?: string | null } | null)?.cover_url ?? null,
    employer: p.employer_name ?? null,
    jobTitle: p.job_title ?? null,
    resumeDone: !!r?.applied_at,
    headline: p.headline ?? null,
    about: p.about ?? null,
    location: p.location ?? null,
    work: workFromRows(rows),
    experienceMonths: experienceMonths(rows),
    certifications: lists.certifications,
    projects: lists.projects,
    education: lists.education,
    links: lists.links,
    recordsReady: records !== null,
    mentorApproved: (mentor.data as { status?: string } | null)?.status === "approved",
    awards: x?.awards ?? [],
    languages: x?.languages ?? [],
    verifyDeadline: v?.window_ends_at ?? null,
    epfoVerified: v?.status === "verified",
  };
}

/** Before the record tables exist, the lists come straight from the stored resume (read only). */
function fromResume(x: ProResume | null): RecordLists {
  const r = x ? recordsFromResume(x) : { certifications: [], education: [], projects: [], links: [] };
  const tag = <T,>(list: T[], p: string): Stored<T>[] => list.map((v, i) => ({ ...v, id: `${p}-${i}`, source: "resume" as const }));
  return { certifications: tag(r.certifications, "c"), education: tag(r.education, "e"), projects: tag(r.projects, "p"), links: tag(r.links, "l") };
}
