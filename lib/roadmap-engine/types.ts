import type { MappingImportance } from "@/lib/curriculum/mapping-rules";
import type { RequirementImportance } from "@/lib/careers/relevance";
import type { ArenaChallengeItem, CertificationItem, LearningItem, ProjectItem } from "@/lib/catalog/match";

/** Everything the (pure) generator needs. Built from real data by load.ts; never contains anything an AI wrote. */
export type Stage = "FOUNDATION" | "INTERMEDIATE" | "JOB_READY";
export type Semester = 1 | 2;

export interface CareerRequirement {
  skillId: string;
  skillName: string;
  importance: RequirementImportance;
  /** 0–100 */
  targetLevel: number;
  stage: Stage;
  /** the skill this one builds on (skills.parent_skill_id), used to order and block milestones */
  parentSkillId: string | null;
}
export interface CourseSkillFact {
  skillId: string;
  /** how strongly the course teaches it; null = ungraded, treated as SUPPORTING */
  importance: MappingImportance | null;
  /** how many of the course's outcomes are confirmed as building this skill */
  outcomeCount: number;
}
export interface CourseInput {
  id: string;
  title: string;
  year: number;
  semester: number | null;
  /** OFFICIAL skills only — confirmed by a person */
  skills: CourseSkillFact[];
  prerequisiteCourseIds: string[];
}
export interface StudentSkillInput {
  /** 0 when not assessed; read `assessed` to tell a measured 0 from nothing */
  level: number;
  /** false = no evidence at all (the level above is a placeholder, shown as "not assessed") */
  assessed: boolean;
  confidence: number;
  verified: boolean;
  verifiedLevel: number | null;
  selfDeclaredLevel: number | null;
}
export interface EngineInput {
  career: { id: string; name: string };
  requirements: CareerRequirement[];
  courses: CourseInput[];
  capability: Record<string, StudentSkillInput>;
  hasAnyCapabilityData: boolean;
  position: { year: number; semester: Semester; totalYears: number };
  student: { id: string; institutionId: string | null };
  catalogs: { learning: LearningItem[]; certifications: CertificationItem[]; projects: ProjectItem[]; arena: ArenaChallengeItem[] };
}

export type Coverage = "STRONG" | "PARTIAL" | "NONE";
export type GapType = "COVERED_BY_CURRICULUM" | "PARTIALLY_COVERED" | "NOT_COVERED" | "NEEDS_PRACTICAL_EXPERIENCE" | "NEEDS_EXTERNAL_LEARNING";

export interface GapRow {
  skillId: string;
  skillName: string;
  importance: RequirementImportance;
  targetLevel: number;
  stage: Stage;
  parentSkillId: string | null;
  /** the level the roadmap counts (verified level, or half of a self-declared one); 0 when not assessed */
  currentLevel: number;
  /** false = nothing has been measured for this skill (display "Not assessed yet", never "0") */
  assessed: boolean;
  confidence: number;
  verified: boolean;
  /** the student has only claimed this skill, with nothing verified */
  selfDeclaredOnly: boolean;
  gap: number;
  met: boolean;
  coverage: Coverage;
  coverageCourseIds: string[];
  coverageOutcomeCount: number;
  /** null when the target is met */
  gapType: GapType | null;
}

export type Tier = "CRITICAL" | "HIGH" | "MODERATE" | "USEFUL";
export type Schedule = "PAST" | "CURRENT" | "UPCOMING" | "FUTURE";
export interface SubjectRow {
  courseId: string;
  title: string;
  year: number;
  semester: number | null;
  score: number;
  tier: Tier;
  /** 1–5 */
  stars: number;
  schedule: Schedule;
  /** deterministic facts the explanation is built from (and an AI sentence may use) */
  facts: { skillIds: string[]; skillNames: string[]; outcomeCount: number; gapPoints: number };
}

export type Horizon = "NOW" | "NEXT" | "THIS_YEAR" | "NEXT_YEAR" | "LONG_TERM";
export type MilestoneStatus = "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "BLOCKED";
export interface MilestoneRow {
  kind: "COURSE" | "SKILL" | "CERTIFICATION" | "PROJECT";
  refId: string;
  title: string;
  horizon: Horizon;
  status: MilestoneStatus;
  reason: string;
  /** shown early although a prerequisite is unmet — the student may start, but it is flagged */
  optionalExploration: boolean;
  blockedBySkillId: string | null;
}

export interface NextBestAction {
  kind: "ASSESS" | "COURSE" | "LEARN" | "ARENA" | "PROJECT" | "NONE";
  skillId: string | null;
  skillName: string | null;
  title: string;
  reason: string;
  ref: { type: "course" | "learning" | "arena" | "project"; id: string } | null;
}
