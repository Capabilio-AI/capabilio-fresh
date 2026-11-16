import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import { experienceMonths, fmtExperience, type ExperienceRow } from "@/lib/professional/experience";

/**
 * What a reviewer can check about a professional who applied to mentor, as short lines. Experience comes from the jobs on their profile and
 * is self-reported until EPFO verification confirms it; the lines say which it is. Applicants who are not professionals get nothing.
 */
export async function mentorEvidence(userIds: readonly string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (!userIds.length) return out;
  const db = untyped(createServiceClient());
  const [jobs, verification, resumes, certs] = await Promise.all([
    db.from("pro_employment").select("user_id, start_date, end_date, period_text").in("user_id", userIds as string[]),
    db.from("pro_verification").select("user_id, status").in("user_id", userIds as string[]),
    db.from("pro_documents").select("user_id").eq("kind", "resume").in("user_id", userIds as string[]),
    db.from("pro_certifications").select("user_id").in("user_id", userIds as string[]),
  ]);
  const by = <T extends { user_id: string }>(rows: unknown): Map<string, T[]> => {
    const m = new Map<string, T[]>();
    for (const r of ((rows ?? []) as T[])) m.set(r.user_id, [...(m.get(r.user_id) ?? []), r]);
    return m;
  };
  const j = by<{ user_id: string } & ExperienceRow>(jobs.data);
  const v = new Map(((verification.data ?? []) as { user_id: string; status: string }[]).map((x) => [x.user_id, x.status]));
  const r = by(resumes.data);
  const c = by(certs.data);
  for (const id of userIds) {
    if (!v.has(id) && !j.has(id)) continue;
    const rows = j.get(id) ?? [];
    const months = experienceMonths(rows);
    const epfo = v.get(id) === "verified";
    out.set(id, [
      `${rows.length} ${rows.length === 1 ? "job" : "jobs"} on the profile, ${months > 0 ? fmtExperience(months) : "no readable dates"} of experience (${epfo ? "EPFO verified" : "self-reported"})`,
      epfo ? "EPFO: employment verified" : "EPFO: not verified yet",
      `${r.has(id) ? "Resume in the Vault" : "No resume in the Vault"}; ${c.get(id)?.length ?? 0} certifications listed`,
    ]);
  }
  return out;
}
