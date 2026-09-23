import { Atom, Calculator, Code2, Compass, MessageSquare, Puzzle, Sigma, type LucideIcon } from "lucide-react";
import type { AssessmentSection } from "@/lib/assessment/sections";

export const SECTION_ICON: Record<AssessmentSection, LucideIcon> = {
  quantitative_aptitude: Calculator,
  logical_reasoning: Puzzle,
  verbal_communication: MessageSquare,
  programming_fundamentals: Code2,
  engineering_mathematics: Sigma,
  basic_sciences: Atom,
  career_interests: Compass,
};
