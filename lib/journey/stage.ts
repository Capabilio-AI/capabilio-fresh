// The student journey, keyed by year of study (computed from start/end year —
// see lib/career/academic-year.ts). Semester granularity was dropped, so a stage
// is never claimed within a year: every stage that belongs to the current year
// is shown as current. Availability of Launchpad / AI Interview is NOT decided
// here — that is lib/career/trigger.ts#isCareerDirectionWindow.
export interface JourneyStage {
  key: string;
  label: string;
  year: number;
}

export const JOURNEY_STAGES: JourneyStage[] = [
  { key: "discover", label: "Discover", year: 1 },
  { key: "develop", label: "Develop", year: 2 },
  { key: "build", label: "Build", year: 2 },
  { key: "specialize", label: "Specialize", year: 3 },
  { key: "experience", label: "Experience", year: 3 },
  { key: "prove", label: "Prove", year: 4 },
  { key: "launch", label: "Launch", year: 4 },
];

/** Index of the first stage belonging to the student's year of study; 0 when the year is unknown. */
export function currentStageIndex(academicYear: number | null): number {
  if (academicYear == null) return 0;
  const clamped = Math.min(academicYear, 4);
  const index = JOURNEY_STAGES.findIndex((s) => s.year === clamped);
  return index === -1 ? 0 : index;
}

export type StageState = "done" | "active" | "upcoming";

export function stageState(stage: JourneyStage, academicYear: number | null): StageState {
  const year = academicYear == null ? 1 : Math.min(academicYear, 4);
  if (stage.year < year) return "done";
  return stage.year === year ? "active" : "upcoming";
}
