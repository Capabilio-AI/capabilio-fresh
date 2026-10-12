import type { Db } from "@/lib/assess/db";
import type { ResumeExtraction } from "@/lib/ai/llm/prompts/resume.v1";
import type { Target } from "@/lib/assess/engine";

const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9+#]+/g, " ").trim();

/** Every skill the resume names, listed once: the skills section plus the skills inside each project. */
export function resumeSkillNames(x: ResumeExtraction): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of [...x.skills, ...x.projects.flatMap((p) => p.skills)]) {
    const n = norm(raw);
    if (n.length >= 1 && !seen.has(n)) {
      seen.add(n);
      out.push(raw.trim());
    }
  }
  return out.slice(0, 80);
}

/**
 * Which of a role's skills the resume claims. A claim matches when the names are the same, or one contains the other as whole words
 * ("Python" and "Python programming"). Short names such as "R" or "C" only match exactly, so "React" never matches "R".
 */
export function matchFocusSkills(resumeSkills: readonly string[], roleSkills: readonly { skillId: string; name: string }[]): string[] {
  const claims = resumeSkills.map(norm).filter(Boolean);
  const hit = (a: string, b: string) => {
    if (a === b) return true;
    if (a.length < 3 || b.length < 3) return false;
    return ` ${a} `.includes(` ${b} `) || ` ${b} `.includes(` ${a} `);
  };
  return roleSkills.filter((s) => claims.some((c) => hit(norm(s.name), c))).map((s) => s.skillId);
}

export async function isGraduate(db: Db, userId: string): Promise<boolean> {
  const { data } = await db.from("profiles").select("student_status").eq("id", userId).maybeSingle();
  return data?.student_status === "graduate";
}

/** The role skills this graduate's resume claims, or null when they are not a graduate or have no resume yet. */
export async function focusSkillIdsFor(db: Db, userId: string, roleSkills: readonly { skillId: string; name: string }[]): Promise<string[] | null> {
  const { data } = await db.from("graduate_resumes").select("skill_names").eq("user_id", userId).maybeSingle();
  if (!data) return null;
  return matchFocusSkills((data.skill_names as string[]) ?? [], roleSkills);
}

/** How much more a resume-claimed skill is asked about: heavier weight for the flexible questions, and one extra guaranteed question. */
export const FOCUS_WEIGHT_BOOST = 1.6;

export function boostTargets(targets: readonly Target[], focusIds: readonly string[] | null | undefined): Target[] {
  if (!focusIds || focusIds.length === 0) return [...targets];
  const focus = new Set(focusIds);
  return targets.map((t) => (focus.has(t.id) ? { ...t, weight: t.weight * FOCUS_WEIGHT_BOOST, min: Math.min(t.max, t.min + 1) } : t));
}
