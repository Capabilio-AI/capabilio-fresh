import { z } from "zod";

/** The shapes a goal can have. A goal is never forced into the job-skill shape that careers use. */
export const PATHWAY_KINDS = ["exam", "portfolio", "credential", "venture"] as const;
export const ROUTE_KINDS = ["exam", "degree", "entrance", "portfolio", "apprenticeship", "direct"] as const;

const text = (max: number) => z.string().trim().min(1).max(max);
const key = z.string().regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "use lowercase words joined by hyphens").max(60);
const httpsUrl = z.string().url().refine((u) => u.startsWith("https://"), "must be an https link");
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "use YYYY-MM-DD");

/** A fact: the only place a date, limit, fee or count may live. No source, no fact. */
export const FactSpec = z.object({
  key,
  label: text(120),
  value: text(300),
  sourceUrl: httpsUrl,
  /** the day a person read this on the official source */
  retrievedAt: isoDate,
  /** after this day the fact must be checked again; default is 90 days after retrieval */
  validUntil: isoDate.optional(),
});
export type FactSpec = z.infer<typeof FactSpec>;

const Resource = z.object({ title: text(140), url: httpsUrl });

export const PathwaySpec = z.object({
  key,
  name: text(100),
  kind: z.enum(PATHWAY_KINDS),
  /** other names students use for this goal (for example a common abbreviation); used to match what they type */
  aliases: z.array(text(60)).max(12).default([]),
  /** what the work is and the honest realities; numbers and dates go in facts and appear as {fact:key} */
  summary: text(1200),
  routes: z.array(z.object({
    key,
    kind: z.enum(ROUTE_KINDS),
    title: text(140),
    body: text(1200),
    officialBody: text(140),
    officialUrl: httpsUrl,
    /** facts that state who may take this route (age, attempts, qualification) */
    eligibilityFacts: z.array(key).default([]),
  })).min(1).max(8),
  stages: z.array(z.object({
    key,
    title: text(100),
    steps: z.array(z.object({ title: text(140), body: text(900), resources: z.array(Resource).max(6).default([]) })).min(1).max(12),
  })).min(2).max(8),
  /** the first seven days: small, concrete, in order */
  startThisWeek: z.array(z.object({ day: z.number().int().min(1).max(7), title: text(140), body: text(500) })).min(3).max(7),
  /** where notifications appear, and how to watch them; links are official */
  watch: z.array(z.object({ title: text(140), url: httpsUrl, how: text(400) })).min(1).max(6),
  /** what Capabilio can and cannot verify for this goal */
  honesty: z.array(text(300)).min(1).max(5),
  /** adjacent routes that reuse the same preparation */
  alternatives: z.array(text(300)).max(6).default([]),
  facts: z.array(FactSpec).max(60).default([]),
});
export type PathwaySpec = z.infer<typeof PathwaySpec>;
export type PathwayStatus = "DRAFT" | "REVIEWED" | "PUBLISHED" | "RETIRED";
