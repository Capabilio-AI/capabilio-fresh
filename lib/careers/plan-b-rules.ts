import { z } from "zod";

export const PLAN_B_KINDS = ["same_role", "higher_studies", "entrepreneur", "change_role", "undecided"] as const;
export type PlanBKind = (typeof PLAN_B_KINDS)[number];

export function isPlanBKind(value: unknown): value is PlanBKind {
  return typeof value === "string" && (PLAN_B_KINDS as readonly string[]).includes(value);
}

/** The student's own answer. A career is named only for "change_role". */
export const PlanBBodySchema = z
  .object({ kind: z.enum(PLAN_B_KINDS), careerId: z.string().uuid().optional() })
  .strict();

export function validatePlanB(
  body: { kind: PlanBKind; careerId?: string },
  primaryCareerId: string | null,
  activeCareerIds: ReadonlySet<string>
): { ok: true } | { ok: false; message: string } {
  const needsMain = body.kind === "same_role" || body.kind === "change_role";
  if (needsMain && !primaryCareerId) return { ok: false, message: "Choose your main career first." };
  if (body.kind === "change_role") {
    if (!body.careerId) return { ok: false, message: "Choose the career you'd move to." };
    if (!activeCareerIds.has(body.careerId)) return { ok: false, message: "That career isn't available." };
    if (body.careerId === primaryCareerId) return { ok: false, message: "Pick a different career from your main one." };
  } else if (body.careerId) {
    return { ok: false, message: "A career can only be chosen with \"Change career role\"." };
  }
  return { ok: true };
}
