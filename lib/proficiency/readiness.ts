/**
 * Whether a STUDENT is ready for a role, as opposed to whether Capabilio's tooling for that role is complete (the Arena gate). Measured against what the role
 * asks for: every required skill has a level a junior needs, and the state follows from how many are met. It describes demonstrated capability against a
 * role definition. It is not a prediction of being hired.
 */
export type Importance = "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
export type ReadinessState = "not_started" | "learning" | "developing" | "demonstrated" | "ready_for_assessment";

export const STATE_LABEL: Record<ReadinessState, string> = {
  not_started: "Not started",
  learning: "Learning",
  developing: "Developing",
  demonstrated: "Demonstrated",
  ready_for_assessment: "Ready for role assessment",
};

/** The level a junior in the role needs, by how much the role depends on the skill. */
export const TARGET_LEVEL: Record<Importance, number> = { CRITICAL: 3, HIGH: 3, MEDIUM: 2, LOW: 1 };
const WEIGHT: Record<Importance, number> = { CRITICAL: 4, HIGH: 3, MEDIUM: 2, LOW: 1 };

/** Share of the weighted requirement that must be met for the top state, so a role with many minor skills is not held up by one low-weight gap. */
export const READY_SHARE = 0.8;
/** Below this share of progress a student is still learning the basics. */
export const LEARNING_BELOW = 0.35;

export interface Requirement {
  skillId: string;
  name: string;
  importance: Importance;
}

export interface Gap {
  skillName: string;
  importance: Importance;
  have: number;
  need: number;
  /** what the next level still needs, from the proficiency model, so the gap is something a student can act on */
  nextSteps: string[];
}

export interface RoleReadiness {
  state: ReadinessState;
  label: string;
  /** weighted progress toward the role's requirements, 0 to 100 */
  progressPct: number;
  met: number;
  total: number;
  /** a sentence a student or recruiter can read without the numbers */
  why: string;
  /** unmet requirements, most important first, then closest to done */
  gaps: Gap[];
}

export function assessRoleReadiness(
  requirements: readonly Requirement[],
  levelBySkill: Readonly<Record<string, number>>,
  nextStepsBySkill: Readonly<Record<string, string[]>> = {},
  roleName = "this role"
): RoleReadiness {
  const rows = requirements.map((r) => {
    const have = levelBySkill[r.skillId] ?? 0;
    const need = TARGET_LEVEL[r.importance];
    return { r, have, need, met: have >= need, weight: WEIGHT[r.importance], credit: Math.min(have, need) / need };
  });
  const total = rows.length;
  const weight = rows.reduce((s, x) => s + x.weight, 0);
  const progress = weight === 0 ? 0 : rows.reduce((s, x) => s + x.weight * x.credit, 0) / weight;
  const metShare = weight === 0 ? 0 : rows.filter((x) => x.met).reduce((s, x) => s + x.weight, 0) / weight;
  const anyWork = rows.some((x) => x.have > 0);
  const core = rows.filter((x) => x.r.importance === "CRITICAL" || x.r.importance === "HIGH");
  const critical = rows.filter((x) => x.r.importance === "CRITICAL");

  let state: ReadinessState;
  if (!anyWork) state = "not_started";
  else if (core.length > 0 && core.every((x) => x.met) && metShare >= READY_SHARE) state = "ready_for_assessment";
  else if (critical.length > 0 && critical.every((x) => x.met)) state = "demonstrated";
  else if (progress < LEARNING_BELOW) state = "learning";
  else state = "developing";

  const gaps: Gap[] = rows
    .filter((x) => !x.met)
    .sort((a, b) => b.weight - a.weight || b.credit - a.credit)
    .map((x) => ({ skillName: x.r.name, importance: x.r.importance, have: x.have, need: x.need, nextSteps: nextStepsBySkill[x.r.skillId] ?? [] }));

  const metCount = rows.length - gaps.length;
  const why =
    state === "not_started"
      ? `No graded work yet toward ${roleName}.`
      : state === "ready_for_assessment"
        ? `Every core skill for ${roleName} is demonstrated at the level a junior needs (${metCount} of ${total} requirements met). The next step is a role assessment, not a job guarantee.`
        : state === "demonstrated"
          ? `The critical skills for ${roleName} are demonstrated; ${gaps.length} other requirement${gaps.length === 1 ? "" : "s"} still below the level a junior needs, starting with ${gaps[0]?.skillName}.`
          : `${metCount} of ${total} requirements for ${roleName} are at the level a junior needs. Biggest gap: ${gaps[0]?.skillName} (Level ${gaps[0]?.have} of the Level ${gaps[0]?.need} needed).`;

  return { state, label: STATE_LABEL[state], progressPct: Math.round(progress * 100), met: metCount, total, why, gaps };
}
