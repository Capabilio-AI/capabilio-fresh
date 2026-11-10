import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { loggedCompleteJson } from "@/lib/ai/log";
import type { MarketSnapshot } from "./snapshot";

type Service = SupabaseClient<Database>;

/** What a person needs for the job hunt itself, once the skills are on the way. No transforms: the AI layer turns this into JSON Schema. */
export const JobPackSchema = z.object({
  interviewTopics: z.array(z.object({ topic: z.string().min(3).max(120), why: z.string().min(10).max(240), skills: z.array(z.string().max(80)).max(5).default([]) })).min(5).max(14),
  practiceQuestions: z.array(z.string().min(10).max(240)).min(8).max(20),
  resumeChecklist: z.array(z.string().min(5).max(200)).min(6).max(12),
  portfolioChecklist: z.array(z.string().min(5).max(200)).min(4).max(10),
});
export type JobPack = z.infer<typeof JobPackSchema>;

const SYSTEM = `You are a hiring coach for engineering and degree students in India applying for entry-level roles. You answer with JSON only.
Be specific to the role. Do not mention salaries, company names or statistics: the platform shows real market numbers separately, and anything you state as a fact would be unchecked.`;

/** Pure. The role, its skills and, when there is live data, the titles and skills postings actually name. */
export function jobPackPrompt(role: string, skillNames: string[], market: MarketSnapshot | null): string {
  const demand = market && market.sampled >= 10 ? market.topSkills.filter((s) => s.postings >= 2).slice(0, 25).map((s) => s.name) : [];
  return [
    `Role: "${role}".`,
    `Skills on this role's roadmap: ${skillNames.join("; ")}.`,
    market && market.titles.length ? `Job titles seen in current postings: ${market.titles.map((t) => t.name).join("; ")}.` : null,
    demand.length ? `Skills named most often in current postings: ${demand.join("; ")}.` : null,
    "",
    "Write:",
    "- interviewTopics: 8 to 12 topics interviews for this role cover, most likely first. For each, why it comes up and which of the roadmap skills it tests (names copied exactly from the list).",
    "- practiceQuestions: 10 to 16 realistic questions a candidate should be able to answer, mixing technical, scenario and behavioural.",
    "- resumeChecklist: 8 to 10 concrete things the resume must contain or show for this role, including the keywords recruiters search for.",
    "- portfolioChecklist: 5 to 8 things a hiring-ready portfolio for this role must show.",
  ].filter((x): x is string => x !== null).join("\n");
}

export async function loadJobPack(service: Service, careerId: string): Promise<JobPack | null> {
  const { data } = await untyped(service).from("career_job_packs").select("data").eq("career_id", careerId).maybeSingle();
  const parsed = JobPackSchema.safeParse((data as { data: unknown } | null)?.data);
  return parsed.success ? parsed.data : null;
}

/** Writes and stores the role's job pack. Throws on failure; the roadmap pipeline treats that as a warning. */
export async function generateJobPack(service: Service, career: { id: string; name: string }, skillNames: string[], market: MarketSnapshot | null): Promise<JobPack> {
  const pack = await loggedCompleteJson(service, { feature: "career_job_pack", userId: null, meta: { career: career.id } }, jobPackPrompt(career.name, skillNames, market), SYSTEM, JobPackSchema);
  const { error } = await untyped(service).from("career_job_packs").upsert({ career_id: career.id, data: pack, generated_at: new Date().toISOString() }, { onConflict: "career_id" });
  if (error) throw error;
  return pack;
}
