import { z } from "zod";
import type { Json } from "@/lib/supabase/types";
import { TIME_LIMIT_MINUTES } from "@/lib/arena-challenges/timer";

export type Difficulty = "easy" | "medium" | "hard";

export const DIFFICULTY_LABEL: Record<Difficulty, string> = { easy: "Beginner", medium: "Intermediate", hard: "Advanced" };

/** Server-controlled difficulty from the candidate's rating on this sub-skill (existing ELO scale, baseline 1200). */
export function difficultyForRating(rating: number): Difficulty {
  if (rating < 1250) return "easy";
  if (rating < 1400) return "medium";
  return "hard";
}

// Shared with Stream (lib/arena-challenges/timer.ts) — both tracks run the same clock.
export { TIME_LIMIT_MINUTES };

// Fixed ELO step by difficulty — mirrors the same lookup in the
// complete_workstation_attempt RPC (supabase/migrations/029_arena_track_separation.sql),
// which is the actual source of truth; this copy is only for the pre-submit
// badge shown in WorkstationShell and must stay in sync with it.
export const ELO_BY_DIFFICULTY: Record<Difficulty, number> = { easy: 8, medium: 12, hard: 15 };

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
