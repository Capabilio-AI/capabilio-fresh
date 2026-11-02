/**
 * Skill proficiency, defined by what a student has demonstrated, never by what they clicked. A level is awarded only when every measurable criterion
 * for it holds, and each level also needs everything the one below it needs. One easy task never moves a skill past Familiarity.
 *
 * Inputs are verified Arena passes: a task the server graded as correct against its own answer key. Counts are of distinct tasks.
 */

export type Difficulty = "easy" | "medium" | "hard";

export interface ProofPoint {
  attemptId: string;
  areaKey: string;
  difficulty: Difficulty;
  /** how many times the student submitted before passing (1 = right first time) */
  submissions: number;
  /** passed the explain-your-work interview for this task: the student could defend how they got it */
  explained: boolean;
}

export const LEVEL_NAMES = ["Not demonstrated", "Familiarity", "Guided practice", "Independent execution", "Workplace application", "Advanced problem solving"] as const;
export type Level = 0 | 1 | 2 | 3 | 4 | 5;

export interface Criterion {
  label: string;
  met: boolean;
}

export interface Proficiency {
  level: Level;
  name: (typeof LEVEL_NAMES)[number];
  /** the criteria of the level reached, so the reason is always on screen */
  reached: Criterion[];
  /** what the next level still needs; null at the top */
  next: { level: Level; name: string; needs: string[] } | null;
  passes: number;
}

const medium = (p: ProofPoint) => p.difficulty !== "easy";
const quick = (p: ProofPoint) => p.submissions <= 2;

/** The criteria of every level above 0, in order. A criterion list is evaluated against the proof points and the number of areas that can prove the skill. */
function criteriaFor(level: 1 | 2 | 3 | 4 | 5, pts: ProofPoint[], areaCount: number): Criterion[] {
  const passes = pts.length;
  const mid = pts.filter(medium);
  const hard = pts.filter((p) => p.difficulty === "hard");
  const explained = pts.filter((p) => p.explained);
  const areasWithMid = new Set(mid.map((p) => p.areaKey)).size;
  const spread = areaCount >= 2 ? 2 : 1;
  switch (level) {
    case 1: return [{ label: "1 verified task passed", met: passes >= 1 }];
    case 2: return [{ label: "3 verified tasks passed", met: passes >= 3 }];
    case 3: return [
      { label: "4 verified tasks passed", met: passes >= 4 },
      { label: "2 of them medium or hard", met: mid.length >= 2 },
      { label: "2 passed within two submissions", met: pts.filter(quick).length >= 2 },
      { label: "1 explained in the interview", met: explained.length >= 1 },
    ];
    case 4: return [
      { label: "6 verified tasks passed", met: passes >= 6 },
      { label: "3 of them medium or hard", met: mid.length >= 3 },
      { label: spread === 2 ? "medium or hard work in 2 different areas" : "medium or hard work done more than once", met: areasWithMid >= spread },
      { label: "3 explained in the interview", met: explained.length >= 3 },
    ];
    case 5: return [
      { label: "8 verified tasks passed", met: passes >= 8 },
      { label: "4 hard tasks passed", met: hard.length >= 4 },
      { label: "2 hard tasks passed within two submissions", met: hard.filter(quick).length >= 2 },
      { label: "5 explained in the interview", met: explained.length >= 5 },
    ];
  }
}

/** Pure. The level a set of verified passes supports, why, and what the next level still needs. `areaCount` is how many Arena areas can prove this skill. */
export function assessProficiency(points: readonly ProofPoint[], areaCount = 1): Proficiency {
  // a task counts once, whatever the data says
  const pts = [...new Map(points.map((p) => [p.attemptId, p])).values()];
  let level: Level = 0;
  for (const l of [1, 2, 3, 4, 5] as const) {
    if (criteriaFor(l, pts, areaCount).every((c) => c.met)) level = l;
    else break;
  }
  const nextLevel = level < 5 ? ((level + 1) as 1 | 2 | 3 | 4 | 5) : null;
  return {
    level,
    name: LEVEL_NAMES[level],
    reached: level === 0 ? [] : criteriaFor(level, pts, areaCount),
    next: nextLevel ? { level: nextLevel, name: LEVEL_NAMES[nextLevel], needs: criteriaFor(nextLevel, pts, areaCount).filter((c) => !c.met).map((c) => c.label) } : null,
    passes: pts.length,
  };
}
