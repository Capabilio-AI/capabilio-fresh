import { z } from "zod";
import type { Json } from "@/lib/supabase/types";

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Beginner", medium: "Intermediate", hard: "Advanced" };

/** Server-controlled difficulty from the candidate's rating on this sub-skill (existing ELO scale, baseline 1200). */
export function difficultyForRating(rating: number): Difficulty {
  if (rating < 1250) return "easy";
  if (rating < 1400) return "medium";
  return "hard";
}

export const TIME_LIMIT_MINUTES: Record<Difficulty, number> = { easy: 20, medium: 30, hard: 40 };

export interface GenerationContext {
  roleName: string;
  parentSkill: string;
  areaName: string;
  difficulty: Difficulty;
  avoidTitles: string[];
}

/** What a tool's generator hands back after its own validation passed. */
export interface GeneratedChallenge {
  title: string;
  category: string;
  requester: string;
  scenario: string;
  objective: string;
  skill_tags: string[];
  time_limit_minutes: number;
  content: Json; // shown to the candidate — never contains answers
  answer_key: Json; // server-only
}

export interface GradeCheck {
  label: string;
  passed: boolean;
}

export interface GradeResult {
  passed: boolean;
  message: string;
  checks: GradeCheck[];
  /** Public extra shown with feedback (e.g. the candidate's own SQL result). Never answer-key data. */
  detail?: Json;
}

export interface ToolDefinition<Submission> {
  toolType: string;
  generationVersion: string;
  gradingVersion: string;
  generate(ctx: GenerationContext): Promise<GeneratedChallenge>;
  submissionSchema: z.ZodType<Submission>;
  grade(content: Json, answerKey: Json, submission: Submission): Promise<GradeResult>;
}

/** Thrown when AI output fails server validation; generation retries (bounded) with a fresh request. */
export class GenerationRejected extends Error {}
