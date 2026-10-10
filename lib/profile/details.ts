import { z } from "zod";

const emptyToNull = (v: unknown) => (typeof v === "string" && v.trim() === "" ? null : v);
const text = (max: number) => z.preprocess(emptyToNull, z.string().trim().max(max).nullable());
export const ProfileDetailsSchema = z.object({
  fullName: z.string().trim().min(1, "Your name can't be empty").max(100),
  headline: text(120),
  bio: text(600),
  location: text(80),
  phone: z.preprocess((v) => (v === undefined ? null : emptyToNull(v)), z.string().trim().regex(/^[+0-9 ()-]{7,20}$/, "Use digits, spaces, + ( ) or -, 7 to 20 characters").nullable()),
  showContact: z.preprocess((v) => v === "on" || v === true, z.boolean()),
});
export type ProfileDetails = z.infer<typeof ProfileDetailsSchema>;

export interface CompletenessInput {
  avatarUrl: string | null;
  coverUrl: string | null;
  headline: string | null;
  bio: string | null;
  aspiringFor: string | null;
  college: string | null;
  branch: string | null;
  graduatingYear: number | null;
  hasBadge: boolean;
  passportShared: boolean;
}
export interface Completeness {
  percent: number;
  /** what is still missing, in the order worth doing it */
  missing: { key: keyof CompletenessInput; label: string }[];
}

const STEPS: { key: keyof CompletenessInput; label: string }[] = [
  { key: "avatarUrl", label: "Add a profile photo" },
  { key: "aspiringFor", label: "Choose what you're aspiring for" },
  { key: "headline", label: "Write a headline" },
  { key: "bio", label: "Write a short About" },
  { key: "college", label: "Add your college" },
  { key: "branch", label: "Add your branch" },
  { key: "graduatingYear", label: "Add your graduating year" },
  { key: "coverUrl", label: "Add a cover image" },
  { key: "hasBadge", label: "Earn your first skill badge" },
  { key: "passportShared", label: "Turn on your skill passport QR" },
];

export function profileCompleteness(input: CompletenessInput): Completeness {
  const missing = STEPS.filter((s) => !input[s.key]);
  return { percent: Math.round(((STEPS.length - missing.length) / STEPS.length) * 100), missing };
}
