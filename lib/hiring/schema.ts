import { z } from "zod";
import { EMPLOYMENT_TYPES, OPENING_STATUSES, APPLICATION_STATUSES, WORK_MODES } from "./types";

const httpUrl = z
  .string()
  .trim()
  .max(500, "That link is too long.")
  .refine((v) => {
    try {
      const u = new URL(v);
      return u.protocol === "https:" || u.protocol === "http:";
    } catch {
      return false;
    }
  }, "Enter a full link that starts with https://");

const listOf = (max: number) => z.array(z.string().trim().min(1).max(300)).max(max);

/** What the public application form sends. `website` is a honeypot: people leave it empty, bots fill it. */
export const ApplySchema = z
  .object({
    openingId: z.string().uuid().nullable(),
    fullName: z.string().trim().min(2, "Enter your name.").max(120),
    email: z.string().trim().email("Enter a valid email address.").max(254),
    workUrl: httpUrl,
    proofNote: z.string().trim().min(40, "Tell us a little more: at least a few sentences about what you did.").max(2000),
    resumeUrl: z.union([httpUrl, z.literal("")]).optional(),
    profileUrl: z.union([httpUrl, z.literal("")]).optional(),
    website: z.string().max(0).optional(),
  })
  .strict();
export type ApplyInput = z.infer<typeof ApplySchema>;

/** A role as the admin form sends it. The slug is optional on create (made from the title). */
export const OpeningInputSchema = z
  .object({
    title: z.string().trim().min(3).max(120),
    slug: z
      .string()
      .trim()
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "Use lowercase letters, numbers and hyphens.")
      .min(3)
      .max(80)
      .optional(),
    team: z.string().trim().min(2).max(60),
    location: z.string().trim().min(2).max(80),
    workMode: z.enum(WORK_MODES),
    employmentType: z.enum(EMPLOYMENT_TYPES),
    summary: z.string().trim().min(10, "The summary needs at least 10 characters.").max(280, "Keep the summary under 280 characters."),
    about: z.string().trim().min(20, "Describe the role in a few sentences.").max(4000),
    responsibilities: listOf(12),
    requirements: listOf(12),
    niceToHave: listOf(12),
    proofBrief: z.string().trim().max(1500).nullable(),
    dayToDay: z.string().trim().max(3000).nullable(),
    firstMonths: listOf(8),
    interview: z.array(z.object({ title: z.string().trim().min(1).max(80), body: z.string().trim().max(400) })).max(8),
    compensation: z.string().trim().max(80).nullable(),
    status: z.enum(OPENING_STATUSES),
    closesOn: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Use a date.")
      .nullable(),
  })
  .strict();
export type OpeningInput = z.infer<typeof OpeningInputSchema>;

export const OpeningPatchSchema = OpeningInputSchema.partial().strict();

export const ApplicationPatchSchema = z
  .object({
    status: z.enum(APPLICATION_STATUSES).optional(),
    internalNote: z.string().trim().max(2000).nullable().optional(),
  })
  .strict()
  .refine((v) => v.status !== undefined || v.internalNote !== undefined, "Nothing to change.");
