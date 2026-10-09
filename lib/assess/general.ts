import { SECTION_LABEL, type AssessmentSection } from "@/lib/assessment/sections";
import { SECTION_SPECS } from "@/lib/question-bank/generate";
import type { Difficulty } from "./config";
import type { Target } from "./engine";
import type { GeneralSlot } from "./slots";

// The common assessment is the same for every student: same sections, same number of questions, and (see commonDifficulty) the same
// difficulty path and the same questions in the same order; only the option order is shuffled per attempt. It never touches role ELO.
//
// Sections are a registry: enabling quantitative aptitude, logical reasoning, etc. later is a one-line `enabled: true` here and a
// pool fill, with no other code change.
export type CommonSection = Exclude<AssessmentSection, "career_interests">;

interface CommonSectionConfig {
  section: CommonSection;
  enabled: boolean;
  questions: number;
  /** student-facing name (the longer legacy label stays available as SECTION_LABEL) */
  label: string;
}

export const COMMON_SECTION_REGISTRY: readonly CommonSectionConfig[] = [
  { section: "verbal_communication", enabled: true, questions: 10, label: "Communication" },
  { section: "programming_fundamentals", enabled: true, questions: 10, label: "Basic Programming" },
  { section: "quantitative_aptitude", enabled: false, questions: 10, label: SECTION_LABEL.quantitative_aptitude },
  { section: "logical_reasoning", enabled: false, questions: 10, label: SECTION_LABEL.logical_reasoning },
  { section: "engineering_mathematics", enabled: false, questions: 10, label: SECTION_LABEL.engineering_mathematics },
  { section: "basic_sciences", enabled: false, questions: 10, label: SECTION_LABEL.basic_sciences },
];

const enabled = COMMON_SECTION_REGISTRY.filter((s) => s.enabled);
const questionsOf = new Map(enabled.map((s) => [s.section as string, s.questions]));

/** `GENERAL` is the stored layer name for the common assessment (kept to avoid a data migration). */
export const GENERAL_SECTIONS: GeneralSlot[] = enabled.map((s) => ({
  kind: "GENERAL",
  section: s.section,
  label: s.label,
  skills: SECTION_SPECS[s.section].skills,
  guidance: SECTION_SPECS[s.section].guidance,
}));

export const GENERAL_TOTAL = enabled.reduce((a, s) => a + s.questions, 0);

/** Per-section question counts for a session: the configured numbers, or the smaller plan fixed when the session started. */
export const generalTargets = (plan?: Record<string, number> | null): Target[] =>
  enabled.map((s) => { const n = Math.min(s.questions, plan?.[s.section] ?? s.questions); return { id: s.section, name: s.label, weight: 1, min: n, max: n }; });

/** What the pool can actually serve per section, capped at the configured count. */
export const planFromAvailability = (available: Record<string, number>): Record<string, number> =>
  Object.fromEntries(enabled.map((s) => [s.section, Math.min(s.questions, available[s.section] ?? 0)]));

/**
 * The fixed difficulty path through a section: roughly 30% easy, 40% medium, 30% hard, easy first. A common assessment that adapted
 * per student could not be compared between students, so it does not adapt; the career assessment is where adaptation lives.
 */
export function commonDifficulty(indexInSection: number, sectionQuestions: number): Difficulty {
  const easy = Math.round(sectionQuestions * 0.3);
  const medium = Math.round(sectionQuestions * 0.4);
  return indexInSection < easy ? "EASY" : indexInSection < easy + medium ? "MEDIUM" : "HARD";
}

export const commonQuestionsIn = (section: string) => questionsOf.get(section) ?? 0;
