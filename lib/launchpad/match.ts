/** The level (0-100) at which a skill counts as ready for work. A skill below it earns partial credit in proportion. */
export const JOB_READY_LEVEL = 60;

export type SkillMatchState = "met" | "building" | "unmeasured" | "unmapped";

export interface SkillMatch {
  /** the skill as the job lists it */
  text: string;
  /** the catalog skill it maps to, or null when it does not map */
  skillId: string | null;
  level: number | null;
  state: SkillMatchState;
  /** 0-1: how much of the job-ready level the user reaches */
  coverage: number;
}

export interface JobMatch {
  /** 0-100, or null when no listed skill can be compared with the catalog */
  percent: number | null;
  skills: SkillMatch[];
  /** skills listed by the job (each counted once) */
  total: number;
  /** skills that map to the catalog and so are part of the percentage */
  counted: number;
  /** of those, how many the user has actually been measured on; the rest count as zero but are shown as unmeasured, not as a low score */
  measured: number;
  /** mapped skills below the job-ready level, weakest first */
  gaps: SkillMatch[];
}

/**
 * Pure. How well a user's measured capability covers what a job asks for. A skill the job lists that is not in the skill catalog
 * is left out of the percentage and reported (the mapping is the weak point, so it is never guessed). No evidence is never a score.
 */
export function matchJob(listed: readonly string[], resolve: (text: string) => string | null, levelOf: (skillId: string) => number | null): JobMatch {
  const seen = new Set<string>();
  const skills: SkillMatch[] = [];
  for (const text of listed) {
    const key = text.trim().toLowerCase();
    if (!key || seen.has(key)) continue;
    seen.add(key);
    const skillId = resolve(text);
    if (!skillId) { skills.push({ text: text.trim(), skillId: null, level: null, state: "unmapped", coverage: 0 }); continue; }
    const level = levelOf(skillId);
    const state: SkillMatchState = level === null ? "unmeasured" : level >= JOB_READY_LEVEL ? "met" : "building";
    skills.push({ text: text.trim(), skillId, level, state, coverage: level === null ? 0 : Math.min(1, level / JOB_READY_LEVEL) });
  }
  const mapped = skills.filter((s) => s.state !== "unmapped");
  const percent = mapped.length === 0 ? null : Math.round((100 * mapped.reduce((sum, s) => sum + s.coverage, 0)) / mapped.length);
  return {
    percent, skills, total: skills.length, counted: mapped.length, measured: mapped.filter((s) => s.level !== null).length,
    gaps: mapped.filter((s) => s.state !== "met").sort((a, b) => a.coverage - b.coverage),
  };
}
