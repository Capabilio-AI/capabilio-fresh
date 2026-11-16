/**
 * Where a student is on the path, from their year of study and whether they have chosen a role. One place decides what is open, so the
 * navigation, the home page and the page guards cannot disagree.
 *
 *   discover  1st year (or year unknown), no role: find out where you stand, look at roles, build the habit
 *   practice  2nd year, no role: common challenges (from 2-1) and role tasters, with a nudge to choose
 *   choose    3rd year onward, no role: choosing a role is required; role pages stay shut until then
 *   role      a role is chosen, in any year: domain challenges, role SkillStudio, roadmap, passport
 */
export type StudentPhase = "discover" | "practice" | "choose" | "role";

export function studentPhase(year: number | null, hasRole: boolean): StudentPhase {
  if (hasRole) return "role";
  if (year == null || year <= 1) return "discover";
  return year === 2 ? "practice" : "choose";
}

/** Common (role-free) challenges open at 2-1; an unknown year never locks anyone out, matching isStreamTerm. */
export const COMMON_CHALLENGES_FIRST_YEAR = 2;

export interface Unlocks {
  /** the role catalogue with tasters, for students who have not chosen yet */
  explore: boolean;
  /** Arena: common challenges, competitions and projects */
  arena: boolean;
  /** skill graph, passport, skills, roadmap, domain challenges: only about a chosen role */
  roleContent: boolean;
  /** the student must pick a role before anything else grows */
  roleRequired: boolean;
}

export function unlocksFor(year: number | null, hasRole: boolean): Unlocks {
  const phase = studentPhase(year, hasRole);
  return {
    explore: phase !== "role",
    arena: hasRole || year == null || year >= COMMON_CHALLENGES_FIRST_YEAR,
    roleContent: phase === "role",
    roleRequired: phase === "choose",
  };
}
