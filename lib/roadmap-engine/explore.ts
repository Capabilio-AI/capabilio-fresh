/** "I'm exploring": rank careers by how close the student already is and how much of each their curriculum already covers. PURE. */
import { courseRelevance, REQUIREMENT_WEIGHT, type CourseSkill, type Requirement } from "@/lib/careers/relevance";
import { effectiveLevel } from "./gaps";
import type { StudentSkillInput } from "./types";

export interface ExplorationCareer {
  id: string;
  name: string;
  requirements: Requirement[];
}

/** score = 100 × (0.5 × readiness-so-far + 0.5 × share of the career's weighted demand the curriculum already covers). 0 when there is no evidence and no curriculum. */
export function rankCareersForExploration(careers: ExplorationCareer[], capability: Record<string, StudentSkillInput>, courses: { skills: CourseSkill[] }[]) {
  const allSkills = courses.flatMap((c) => c.skills);
  return careers
    .map((c) => {
      const total = c.requirements.reduce((n, r) => n + REQUIREMENT_WEIGHT[r.importance], 0);
      const earned = c.requirements.reduce((n, r) => n + REQUIREMENT_WEIGHT[r.importance] * Math.min(effectiveLevel(capability[r.skillId]) / Math.max(r.targetLevel, 1), 1), 0);
      const progress = total > 0 ? earned / total : 0;
      const coverage = courseRelevance(allSkills, c.requirements).score;
      return { careerId: c.id, careerName: c.name, score: Math.round((0.5 * progress + 0.5 * coverage) * 100) };
    })
    .sort((a, b) => b.score - a.score || a.careerName.localeCompare(b.careerName));
}
