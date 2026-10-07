import { z } from "zod";

const text = (min: number, max: number) => z.string().trim().min(min).max(max);

/** Lower-cased, de-duplicated, trimmed expertise tags. */
export function normalizeExpertise(tags: readonly string[]): string[] {
  return [...new Set(tags.map((t) => t.trim().replace(/\s+/g, " ")).filter(Boolean).map((t) => t.slice(0, 40)))];
}

export const MentorApplicationSchema = z
  .object({
    headline: text(5, 120),
    bio: text(20, 800),
    expertise: z.array(z.string().trim().min(1).max(40)).min(1).max(8).transform(normalizeExpertise),
    company: text(1, 120).optional().or(z.literal("").transform(() => undefined)),
    roleTitle: text(1, 120).optional().or(z.literal("").transform(() => undefined)),
    yearsExperience: z.coerce.number().int().min(0).max(60).optional(),
    availability: text(1, 200).optional().or(z.literal("").transform(() => undefined)),
  })
  .strict();
export type MentorApplication = z.infer<typeof MentorApplicationSchema>;

/** Fields shown publicly: changing any of them sends an approved profile back for review. Availability and the accepting switch do not. */
export const REVIEWED_FIELDS = ["headline", "bio", "expertise", "company", "roleTitle", "yearsExperience"] as const;

export function needsReReview(prev: MentorApplication, next: MentorApplication): boolean {
  return REVIEWED_FIELDS.some((f) => JSON.stringify(prev[f] ?? null) !== JSON.stringify(next[f] ?? null));
}
