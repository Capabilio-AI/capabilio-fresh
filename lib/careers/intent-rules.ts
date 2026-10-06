import { z } from "zod";

/** Pure rules and request schemas for a student's career intent. The student is always the caller; a body can never name one. */
export interface IntentState {
  primaryCareerId: string | null;
  secondaryCareerId: string | null;
  isExploring: boolean;
}

export function validateIntent(next: IntentState, activeCareerIds: ReadonlySet<string>): { ok: true } | { ok: false; message: string } {
  const { primaryCareerId: p, secondaryCareerId: s } = next;
  if (p && !activeCareerIds.has(p)) return { ok: false, message: "That career isn't available." };
  if (s && !activeCareerIds.has(s)) return { ok: false, message: "That Plan B career isn't available." };
  if (s && !p) return { ok: false, message: "Choose a main career before a Plan B." };
  if (p && p === s) return { ok: false, message: "Your Plan B should be a different career." };
  return { ok: true };
}

const id = z.string().uuid();
export const IntentBodySchema = z
  .object({ primaryCareerId: id.nullable().optional(), secondaryCareerId: id.nullable().optional(), isExploring: z.boolean().optional() })
  .strict()
  .refine((b) => Object.keys(b).length > 0, { message: "Nothing to update." });
export const GoalTextSchema = z.object({ goalText: z.string().trim().min(3).max(500) }).strict();
export const ResolveSuggestionSchema = z
  .object({ action: z.enum(["accept", "dismiss"]), careerId: id.optional(), as: z.enum(["primary", "secondary"]).optional() })
  .strict()
  .refine((b) => b.action === "dismiss" || b.careerId !== undefined, { message: "Choose which career to accept." });
