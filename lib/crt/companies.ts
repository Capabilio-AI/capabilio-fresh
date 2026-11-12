import { z } from "zod";
import { CATEGORIES, type Category } from "./categories";

export const SECTORS = ["Technology", "Management", "Core engineering", "Finance", "Other"] as const;
export const ROUND_KINDS = ["online_assessment", "coding", "technical_interview", "hr_interview", "group_discussion"] as const;
export type RoundKind = (typeof ROUND_KINDS)[number];
export const ROUND_LABEL: Record<RoundKind, string> = { online_assessment: "Online assessment", coding: "Coding round", technical_interview: "Technical interview", hr_interview: "HR interview", group_discussion: "Group discussion" };

export const MAX_ROUND_QUESTIONS = 120;
const MIN_SECONDS_PER_QUESTION = 20;
const DEFAULT_SECONDS_PER_QUESTION = 60;

export interface Section { category: Category; count: number }
export interface CompanyRound { position: number; kind: RoundKind; title: string; minutes: number | null; negativeMarking: number; sections: Section[]; notes: string | null }
export interface CompanyHeader { slug: string; name: string; sector: (typeof SECTORS)[number]; about: string | null; process: string[]; officialUrl: string | null; patternSourceUrl: string | null; patternCheckedOn: string | null }

const SectionSchema = z.object({ category: z.enum(CATEGORIES), count: z.number().int().min(1).max(MAX_ROUND_QUESTIONS) }).strict();
const RoundSchema = z.object({
  position: z.number().int().min(1).max(12),
  kind: z.enum(ROUND_KINDS),
  title: z.string().trim().min(2).max(120),
  minutes: z.number().int().min(5).max(360).nullable(),
  negativeMarking: z.number().min(0).max(1),
  sections: z.array(SectionSchema).max(10).default([]),
  notes: z.string().trim().max(800).nullable().default(null),
}).strict();
const https = z.string().trim().max(500).regex(/^https:\/\/\S+$/, "Use a full https link.");

/** What the admin screen sends: a company and its rounds. A draft may leave the source blank; publishing may not (see canPublish). */
export const CompanyInput = z.object({
  slug: z.string().regex(/^[a-z0-9-]{2,60}$/, "Lowercase letters, digits and dashes only."),
  name: z.string().trim().min(2).max(80),
  sector: z.enum(SECTORS),
  about: z.string().trim().max(1200).nullable(),
  process: z.array(z.string().trim().min(2).max(160)).max(10),
  officialUrl: https.nullable(),
  patternSourceUrl: https.nullable(),
  patternCheckedOn: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable(),
  rounds: z.array(RoundSchema).max(12),
}).strict().refine((c) => new Set(c.rounds.map((r) => r.position)).size === c.rounds.length, { message: "Two rounds cannot share a position." });
export type CompanyInput = z.infer<typeof CompanyInput>;

/** Pure. Sections read back from stored JSON; anything malformed is dropped rather than trusted. */
export function sectionsFrom(raw: unknown): Section[] {
  if (!Array.isArray(raw)) return [];
  return raw.flatMap((s) => {
    const r = SectionSchema.safeParse(s);
    return r.success ? [r.data] : [];
  });
}

const questionsIn = (r: Pick<CompanyRound, "sections">) => r.sections.reduce((n, s) => n + s.count, 0);

/** Pure. How long the whole paper lasts: the company's time, or a minute a question when the pattern gives none. */
export const roundSeconds = (r: Pick<CompanyRound, "minutes" | "sections">): number => (r.minutes ? r.minutes * 60 : questionsIn(r) * DEFAULT_SECONDS_PER_QUESTION);

/** Pure. The company's total time spread over its questions (never under 20 seconds each), the per-question limit the exam screen enforces. */
export function secondsPerQuestion(r: Pick<CompanyRound, "minutes" | "sections">): number {
  const q = questionsIn(r);
  if (q === 0) return DEFAULT_SECONDS_PER_QUESTION;
  return Math.max(MIN_SECONDS_PER_QUESTION, Math.round(roundSeconds(r) / q));
}

export interface Paper { title: string; parts: Section[]; questions: number; secondsPerQuestion: number; negativeMarking: number }

/** Pure. The timed paper a round gives, or null for a round that is not a multiple-choice paper (interviews, coding) or is not sensible. */
export function paperOf(companyName: string, r: CompanyRound): Paper | null {
  if (r.kind !== "online_assessment" || r.sections.length === 0) return null;
  const questions = questionsIn(r);
  if (questions > MAX_ROUND_QUESTIONS) return null;
  return { title: `${companyName}: ${r.title}`, parts: r.sections, questions, secondsPerQuestion: secondsPerQuestion(r), negativeMarking: r.negativeMarking };
}

/** Pure. A company may reach students only with the source of its pattern, when it was checked, and at least one paper to take. */
export function canPublish(c: CompanyHeader, rounds: CompanyRound[]): { ok: true } | { ok: false; reason: string } {
  if (!c.patternSourceUrl) return { ok: false, reason: "Add the link the pattern came from." };
  if (!c.patternCheckedOn) return { ok: false, reason: "Add the date the pattern was checked." };
  if (!rounds.some((r) => paperOf(c.name, r))) return { ok: false, reason: "Add at least one online assessment with sections." };
  return { ok: true };
}
