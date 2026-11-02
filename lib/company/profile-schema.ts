import { z } from "zod";

export const SIZE_BANDS = ["1-10", "11-50", "51-200", "201-1000", "1001-5000", "5000+"] as const;
export const COMPANY_POST_TYPES = ["update", "hiring", "milestone", "event"] as const;

const list = (max: number, item = 60) => z.array(z.string().trim().min(1).max(item)).max(max);
const httpUrl = z.string().trim().url().max(2000).refine((u) => /^https?:\/\//i.test(u), "Use an http or https link.");

/** What a company admin may set on its public profile. Strict: nothing else (is_public lives in org_profiles and has its own switch). */
export const CompanyProfileInputSchema = z
  .object({
    tagline: z.string().trim().max(140).nullable(),
    mission: z.string().trim().max(600).nullable(),
    industry: z.string().trim().min(2).max(60).nullable(),
    sizeBand: z.enum(SIZE_BANDS).nullable(),
    foundedYear: z.number().int().min(1800).max(2100).nullable(),
    hqCity: z.string().trim().max(80).nullable(),
    logoUrl: httpUrl.nullable(),
    accent: z.string().regex(/^#[0-9a-fA-F]{6}$/, "Use a hex colour like #1a73e8.").nullable(),
    culture: list(8, 120),
    perks: list(12),
    techStack: list(20, 40),
  })
  .strict();
export type CompanyProfileInput = z.infer<typeof CompanyProfileInputSchema>;

/** Pure. snake_case columns for the upsert; blank strings become null so "cleared" really clears. */
export function toProfileColumns(input: CompanyProfileInput): Record<string, unknown> {
  const blank = (v: string | null) => (v === null || v === "" ? null : v);
  return {
    tagline: blank(input.tagline),
    mission: blank(input.mission),
    industry: blank(input.industry),
    size_band: input.sizeBand,
    founded_year: input.foundedYear,
    hq_city: blank(input.hqCity),
    logo_url: blank(input.logoUrl),
    accent: blank(input.accent)?.toLowerCase() ?? null,
    culture: input.culture,
    perks: input.perks,
    tech_stack: input.techStack,
    updated_at: new Date().toISOString(),
  };
}
