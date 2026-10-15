import type { Db } from "@/lib/assess/db";
import type { ResumeExtraction } from "@/lib/ai/llm/prompts/resume.v1";
import { GOOD_MATCH } from "@/lib/assess/roles";

/** What the resume says the person does: their headline and most recent job title. These name the role better than the skills do. */
export const roleQueryFrom = (x: ResumeExtraction): string | null =>
  [x.summary.headline, x.experience[0]?.title].filter(Boolean).join(" ").trim().slice(0, 200) || null;

/** The role in the catalogue the resume points to, by the same database match the role picker uses (no model call). Null when unsure. */
export async function suggestRoleFromResume(db: Db, x: ResumeExtraction): Promise<string | null> {
  const query = roleQueryFrom(x);
  if (!query) return null;
  const { data } = await db.rpc("match_careers", { p_query: query, p_limit: 1 });
  const top = ((data ?? []) as { career_id: string; score: number }[])[0];
  return top && top.score >= GOOD_MATCH ? top.career_id : null;
}
