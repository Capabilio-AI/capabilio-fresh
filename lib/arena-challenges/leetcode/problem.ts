import { z } from "zod";

export const TARGET_BY_DIFFICULTY = { easy: 3, medium: 4, hard: 2 } as const;
export const WEEKLY_TARGET = 9; // the largest number the wheel can give
/** Once this many LeetCode-style problems are stored, the AI is never asked for more: every week is served from the database. */
export const STREAM_BANK_CAP = 1000;

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

export const GeneratedProblemSchema = z.object({
  title: text(3, 80),
  category: text(2, 40),
  difficulty: z.enum(["easy", "medium", "hard"]),
  statement: text(40, 2500),
  input_format: text(5, 600),
  output_format: text(5, 600),
  constraints: z.array(text(2, 200)).min(1).max(6),
  sample_inputs: z.array(text(1, 400)).length(2),
  sample_explanations: z.array(text(5, 500)).length(2),
  hidden_inputs: z.array(text(1, 1500)).min(4).max(6),
  reference_solution: text(10, 4000),
  starter_python: text(10, 1500),
  starter_c: text(10, 1500),
  skill_tags: z.array(text(2, 40)).min(1).max(5),
});
export type GeneratedProblem = z.infer<typeof GeneratedProblemSchema>;
export const GeneratedBatchSchema = z.object({ problems: z.array(z.unknown()).min(1) });

/** What a student may see of a problem. Test outputs beyond the two examples never leave the server. */
export interface PublicProblem {
  statement: string;
  inputFormat: string;
  outputFormat: string;
  constraints: string[];
  examples: { input: string; output: string; explanation: string }[];
  starters: { python: string; c: string };
}
