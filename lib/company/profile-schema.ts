import { z } from "zod";

export const SIZE_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"] as const;

const list = (max: number, item = 60) => z.array(z.string().trim().min(1).max(item)).max(max);
const httpUrl = z.string().trim().url().max(2000).refine((u) => /^https?:\/\//i.test(u), "Use an http or https link.");
const text = (max: number) => z.string().trim().max(max).nullable();

/**
 * What a company admin may set on its public page. Strict: nothing else (no logo or cover, which only the upload route sets; no institution id).
 * Fields split across tables on save: tagline, about, website, founded year and the public switch go to org_profiles, city to institutions,
 * the rest to company_profiles.
 */
export const CompanyProfileInputSchema = z
  .object({
    tagline: text(160),
    about: text(3000),
    websiteUrl: httpUrl.nullable(),
    foundedYear: z.number().int().min(1800).max(2100).nullable(),
    city: text(100),
    isPublic: z.boolean(),
    mission: text(600),
    industry: z.string().trim().min(2).max(60).nullable(),
    sizeBand: z.enum(SIZE_BANDS).nullable(),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1a73e8.").nullable(),
    culture: list(8, 120),
    perks: list(12),
    techStack: list(20, 40),
  })
  .strict();
export type CompanyProfileInput = z.infer<typeof CompanyProfileInputSchema>;

const blank = (v: string | null) => (v === null || v === "" ? null : v);

/** Pure. The three column sets the save writes; blank strings become null so "cleared" really clears. */
export function splitProfile(input: CompanyProfileInput, now: Date = new Date()) {
  const updated_at = now.toISOString();
  return {
    org: { tagline: blank(input.tagline), bio: blank(input.about), website_url: input.websiteUrl, founded_year: input.foundedYear, is_public: input.isPublic, updated_at },
    city: blank(input.city),
    company: {
      mission: blank(input.mission),
      industry: input.industry,
      size_band: input.sizeBand,
      accent: input.accent?.toLowerCase() ?? null,
      culture: input.culture,
      perks: input.perks,
      tech_stack: input.techStack,
      updated_at,
    },
  };
}
