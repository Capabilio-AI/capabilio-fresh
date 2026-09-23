import type { Enums } from "@/lib/supabase/types";

export type AssessmentSection = Enums<"assessment_section">;

export const QUESTIONS_PER_SECTION = 25;

// Canonical order. career_interests is last and generated dynamically —
// see lib/assessment/career-interests.ts — not pulled from question_bank.
export const SECTION_ORDER: AssessmentSection[] = [
  "technical_fundamentals",
  "aptitude_reasoning",
  "communication",
  "problem_solving",
  "digital_ai_literacy",
  "career_interests",
];

export const SECTION_LABEL: Record<AssessmentSection, string> = {
  technical_fundamentals: "Technical Fundamentals",
  aptitude_reasoning: "Aptitude / Reasoning",
  communication: "Communication",
  problem_solving: "Problem-Solving",
  digital_ai_literacy: "Digital / AI Literacy",
  career_interests: "Career Interests",
};

export function nextSection(current: AssessmentSection | null): AssessmentSection | null {
  if (current === null) return SECTION_ORDER[0];
  const index = SECTION_ORDER.indexOf(current);
  return SECTION_ORDER[index + 1] ?? null;
}
