import type { Enums } from "@/lib/supabase/types";

export type AssessmentSection = Enums<"assessment_section">;

// Per-section question counts — not uniform. Programming and Math run
// shorter (15/20) per the 1-2 sem B.Tech brief; the rest are 25.
export const QUESTIONS_PER_SECTION: Record<AssessmentSection, number> = {
  quantitative_aptitude: 25,
  logical_reasoning: 25,
  verbal_communication: 25,
  programming_fundamentals: 15,
  engineering_mathematics: 20,
  basic_sciences: 25,
  career_interests: 25,
};

// Each question gets a hard 45s timer client-side (see AssessmentRunner).
export const SECONDS_PER_QUESTION = 45;

// Canonical order. career_interests is last and generated dynamically —
// see lib/assessment/career-interests.ts — not pulled from question_bank.
export const SECTION_ORDER: AssessmentSection[] = [
  "quantitative_aptitude",
  "logical_reasoning",
  "verbal_communication",
  "programming_fundamentals",
  "engineering_mathematics",
  "basic_sciences",
  "career_interests",
];

export const SECTION_LABEL: Record<AssessmentSection, string> = {
  quantitative_aptitude: "Quantitative Aptitude",
  logical_reasoning: "Logical & Analytical Reasoning",
  verbal_communication: "Verbal Ability & Communication",
  programming_fundamentals: "Basic Programming & Computational Thinking",
  engineering_mathematics: "Engineering Mathematics Fundamentals",
  basic_sciences: "Basic Sciences & Engineering Awareness",
  career_interests: "Career Interests",
};

export function nextSection(current: AssessmentSection | null): AssessmentSection | null {
  if (current === null) return SECTION_ORDER[0];
  const index = SECTION_ORDER.indexOf(current);
  return SECTION_ORDER[index + 1] ?? null;
}
