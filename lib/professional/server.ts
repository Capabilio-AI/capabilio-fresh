import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import type { ProResume } from "./resume-schema";
import { proRowsFrom } from "./resume";
import { recordsFromResume } from "./records";
import { replaceResumeRecords } from "./records-server";
import { seedResumeSkills } from "./workspace-server";

const db = () => untyped(createServiceClient());
const WINDOW_MS = 7 * 86_400_000;

export interface CurrentJob { employerName: string; jobTitle: string; employedSince?: string | null }

/**
 * Makes sure a professional has their own rows: a profile, a verification window that runs seven days from sign-up, and their jobs.
 * Safe to call again. Jobs a graduate recorded before moving across are copied once; the old rows stay where they were.
 */
export async function ensureProfessional(userId: string, job?: CurrentJob): Promise<void> {
  const { data: account } = await db().from("profiles").select("created_at").eq("id", userId).maybeSingle();
  const created = Date.parse((account as { created_at?: string } | null)?.created_at ?? "") || Date.now();
  await db().from("pro_profiles").upsert({ user_id: userId, employer_name: job?.employerName ?? null, job_title: job?.jobTitle ?? null }, { onConflict: "user_id", ignoreDuplicates: true });
  await db().from("pro_verification").upsert({ user_id: userId, window_ends_at: new Date(created + WINDOW_MS).toISOString() }, { onConflict: "user_id", ignoreDuplicates: true });

  const { count } = await db().from("pro_employment").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) > 0) return;
  const { data: before } = await db().from("employment_history").select("employer_name, job_title, start_date, end_date").eq("user_id", userId);
  const rows = ((before ?? []) as { employer_name: string; job_title: string; start_date: string | null; end_date: string | null }[]).map((r) => ({ ...r, user_id: userId, source: "entered" }));
  const listed = rows.some((r) => r.end_date === null && r.employer_name === job?.employerName && r.job_title === job?.jobTitle);
  if (job && !listed) rows.push({ employer_name: job.employerName, job_title: job.jobTitle, start_date: job.employedSince ?? null, end_date: null, user_id: userId, source: "entered" });
  if (rows.length) await db().from("pro_employment").insert(rows);
}

/** Records one job the professional added. A current job (no end date) also becomes the profile's current job. */
export async function addProJob(userId: string, job: { employerName: string; jobTitle: string; employedSince?: string | null; employedUntil?: string | null }): Promise<boolean> {
  const { error } = await db().from("pro_employment").insert({ user_id: userId, employer_name: job.employerName, job_title: job.jobTitle, start_date: job.employedSince ?? null, end_date: job.employedUntil ?? null, source: "entered" });
  if (error) return false;
  if (!job.employedUntil) await db().from("pro_profiles").update({ employer_name: job.employerName, job_title: job.jobTitle, updated_at: new Date().toISOString() }).eq("user_id", userId);
  return true;
}

/** Keeps what was read from a professional's resume in their own tables. Earlier resume jobs are replaced; jobs they entered are never touched. */
export async function saveProResume(userId: string, fileName: string, extraction: ProResume, model: string): Promise<void> {
  const now = new Date().toISOString();
  const rows = proRowsFrom(extraction);
  const { error } = await db().from("pro_resumes").upsert({ user_id: userId, file_name: fileName.slice(0, 255), extraction, skill_names: extraction.skills, model, applied_at: now, updated_at: now }, { onConflict: "user_id" });
  if (error) throw error;
  await db().from("pro_profiles").upsert({ user_id: userId, ...rows.profile, updated_at: now }, { onConflict: "user_id" });
  await db().from("pro_employment").delete().eq("user_id", userId).eq("source", "resume");
  if (rows.employment.length) await db().from("pro_employment").insert(rows.employment.map((e) => ({ ...e, user_id: userId, source: "resume" })));
  await seedResumeSkills(userId, extraction.skills);
  // Certifications, education, projects and links become editable rows. If those tables are not there yet the pages read the stored resume instead.
  await replaceResumeRecords(userId, recordsFromResume(extraction)).catch((e: Error) => console.error("[professional] could not save resume records:", e.message));
}

/** Saves the "about you" fields on the professional's own profile. */
export async function saveAbout(userId: string, v: { headline: string | null; location: string | null; about: string | null }): Promise<void> {
  const { error } = await db().from("pro_profiles").upsert({ user_id: userId, ...v, updated_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
}

/** Removes one of the professional's own jobs. False when it is not theirs. If it was the current job, the profile's current job is cleared. */
export async function removeProJob(userId: string, jobId: string): Promise<boolean> {
  const { data, error } = await db().from("pro_employment").delete().eq("id", jobId).eq("user_id", userId).select("employer_name, job_title, end_date");
  if (error) throw error;
  const gone = ((data ?? []) as { employer_name: string; job_title: string; end_date: string | null }[])[0];
  if (!gone) return false;
  if (gone.end_date === null) {
    const { data: p } = await db().from("pro_profiles").select("employer_name, job_title").eq("user_id", userId).maybeSingle();
    const cur = p as { employer_name: string | null; job_title: string | null } | null;
    if (cur?.employer_name === gone.employer_name && cur?.job_title === gone.job_title) {
      const { data: next } = await db().from("pro_employment").select("employer_name, job_title").eq("user_id", userId).is("end_date", null).order("start_date", { ascending: false, nullsFirst: false }).limit(1);
      const n = ((next ?? []) as { employer_name: string; job_title: string }[])[0];
      await db().from("pro_profiles").update({ employer_name: n?.employer_name ?? null, job_title: n?.job_title ?? null, updated_at: new Date().toISOString() }).eq("user_id", userId);
    }
  }
  return true;
}
