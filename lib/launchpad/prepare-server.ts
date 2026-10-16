import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { loadSkillContext, type SkillContext } from "@/lib/arena/skill-context";
import { extractSkills } from "@/lib/skills/extract";
import { matchJob, type JobMatch } from "./match";
import { buildPreparation, type Preparation } from "./prepare";

/** Everything the plan screen shows. Plain data, so it can cross from the server to the page. */
export interface PreparationView {
  title: string;
  /** the skills the plan is built on, as the job lists them */
  skills: string[];
  match: JobMatch;
  preparation: Preparation;
}

const planFor = (ctx: SkillContext, title: string, skills: string[]): PreparationView => {
  const match = matchJob(skills, ctx.resolve, ctx.levelOf);
  return { title, skills, match, preparation: buildPreparation(match, ctx.practisable) };
};

/** A plan for a listed job whose skills are already known. Reads only. */
export async function loadPreparation(service: SupabaseClient<Database>, userId: string, job: { title: string; skills: string[] }): Promise<PreparationView> {
  return planFor(await loadSkillContext(service, userId), job.title, job.skills);
}

/** A plan for a pasted job description: the skills are found by matching the text against the skill catalog (no AI), then compared with the user. */
export async function loadPreparationFromText(service: SupabaseClient<Database>, userId: string, job: { title: string; text: string }): Promise<PreparationView | null> {
  const ctx = await loadSkillContext(service, userId);
  const skills = extractSkills(job.text, ctx.index, ctx.names);
  return skills.length === 0 ? null : planFor(ctx, job.title, skills);
}
