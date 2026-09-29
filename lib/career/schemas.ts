import { z } from "zod";
import { GOAL_STATES } from "./direction";

// strict(): any extra key — userId, membershipId, assessmentMode, inWindow… — is rejected, never silently trusted.
export const YearBodySchema = z
  .object({
    startYear: z.number().int(),
    endYear: z.number().int(),
    currentYearOverride: z.number().int().min(1).max(8).nullable(),
  })
  .strict();

export const GoalStateBodySchema = z.object({ goalState: z.enum(GOAL_STATES) }).strict();

export const DismissBodySchema = z.object({ prompt: z.enum(["goal", "checkin"]) }).strict();
