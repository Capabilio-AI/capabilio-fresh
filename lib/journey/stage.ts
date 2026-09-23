// The student journey, as year-semester ("<year>-<semester>", e.g. "3-2")
// strings the way institution_memberships.year already stores them. No
// stage table exists yet — stage is a pure function of year-semester so
// there is nothing to keep in sync.
export interface JourneyStage {
  key: string;
  label: string;
  yearSemester: string;
}

export const JOURNEY_STAGES: JourneyStage[] = [
  { key: "discover", label: "Discover", yearSemester: "1-2" },
  { key: "develop", label: "Develop", yearSemester: "2-1" },
  { key: "build", label: "Build", yearSemester: "2-2" },
  { key: "specialize", label: "Specialize", yearSemester: "3-1" },
  { key: "experience", label: "Experience", yearSemester: "3-2" },
  { key: "prove", label: "Prove", yearSemester: "4-1" },
  { key: "launch", label: "Launch", yearSemester: "4-2" },
];

// The stage that gates Launchpad + AI Interview.
export const UNLOCK_STAGE_KEY = "experience";

function yearSemesterRank(yearSemester: string): number {
  const [year, sem] = yearSemester.split("-").map(Number);
  if (Number.isNaN(year) || Number.isNaN(sem)) return 0;
  return year * 10 + sem;
}

/** Current stage from the student's year-semester; defaults to the first stage when unknown. */
export function currentStageIndex(year: string | null): number {
  if (!year) return 0;
  const rank = yearSemesterRank(year);
  let index = 0;
  for (let i = 0; i < JOURNEY_STAGES.length; i++) {
    if (rank >= yearSemesterRank(JOURNEY_STAGES[i].yearSemester)) index = i;
  }
  return index;
}

export function isStageUnlocked(year: string | null, stageKey: string = UNLOCK_STAGE_KEY): boolean {
  const targetIndex = JOURNEY_STAGES.findIndex((s) => s.key === stageKey);
  return currentStageIndex(year) >= targetIndex;
}
