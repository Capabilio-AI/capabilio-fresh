import { z } from "zod";

/** A student may change their main career role from the dashboard this many times, ever. Choosing the first role and Plan B are not changes. */
export const ROLE_CHANGE_LIMIT = 3;

export const ROLE_CHANGE_REASONS = [
  { value: "wrong_role_at_signup", label: "I entered the wrong role when I signed up" },
  { value: "better_fit", label: "I found a role that fits me better" },
  { value: "lost_interest", label: "I tried this role and lost interest" },
  { value: "goal_changed", label: "My career goal has changed" },
  { value: "other", label: "Something else" },
] as const;
export type RoleChangeReason = (typeof ROLE_CHANGE_REASONS)[number]["value"];

const REASON_VALUES = ROLE_CHANGE_REASONS.map((r) => r.value) as [RoleChangeReason, ...RoleChangeReason[]];
export const MIN_OTHER_DETAILS = 10;
export const MAX_DETAILS = 400;

/** The student's own request. The student is always the caller; a body cannot name one. "Something else" needs a sentence saying what. */
export const RoleChangeBodySchema = z
  .object({
    careerId: z.string().uuid(),
    reason: z.enum(REASON_VALUES),
    details: z.string().trim().max(MAX_DETAILS).optional(),
    typed: z.string().max(160).optional(),
  })
  .strict()
  .refine((b) => b.reason !== "other" || (b.details?.length ?? 0) >= MIN_OTHER_DETAILS, { message: "Tell us in a sentence why you want to change.", path: ["details"] });

export function roleChangesLeft(used: number): number {
  return Math.max(0, ROLE_CHANGE_LIMIT - used);
}

export const ROLE_LIMIT_MESSAGE = `You have used all ${ROLE_CHANGE_LIMIT} role changes. Your role stays as it is.`;
export const ROLE_LOCKED_MESSAGE = "Change your role from your dashboard.";
