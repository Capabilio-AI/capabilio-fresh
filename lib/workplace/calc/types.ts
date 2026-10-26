import type { Difficulty } from "@/lib/arena-workstations/types";
import type { ExperienceLevel } from "@/lib/workplace/level";
import type { Rng } from "@/lib/workplace/rng";

export interface CalcParam {
  label: string;
  value: string;
  unit: string;
}

export interface CalcField {
  key: string;
  label: string;
  /** shown next to the input; the student enters the bare number in this unit */
  unit: string;
  help?: string;
}

/** Server-only: the expected number and the absolute tolerance for each field key. */
export interface CalcKey {
  expected: Record<string, number>;
  tolerance: Record<string, number>;
}

export interface CalcDraft {
  title: string;
  requester: { name: string; title: string };
  scenario: string;
  params: CalcParam[];
  fields: CalcField[];
  key: CalcKey;
  /** formula sheet lines, shown to the student */
  reference: string[];
}

export interface CalcTemplate {
  id: string;
  areas: string[];
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  build(rng: Rng): CalcDraft;
}

/** What the student sees (never the key). */
export interface CalcContent {
  params: CalcParam[];
  fields: CalcField[];
  reference: string[];
  maxSubmissions: number;
  deliverable: string;
}

/** Absolute tolerance for an expected value: `rel` of its size, never below `floor`. */
export const relTol = (expected: number, rel = 0.02, floor = 1e-9): number => Math.max(Math.abs(expected) * rel, floor);
