import { z } from "zod";
import type { Difficulty } from "@/lib/arena-workstations/types";
import type { ExperienceLevel } from "../level";
import type { Requester } from "../tickets/types";

/** The parts of the business document a ticket asks for. */
export const SECTION_KEYS = ["stories", "issues", "tests", "process", "raci", "gaps"] as const;
export type SectionKey = (typeof SECTION_KEYS)[number];

/** One numbered statement from a stakeholder: a requirement, a duplicate, a contradiction, something vague, or just an opinion. */
export interface Note {
  id: string;
  from: string;
  text: string;
}

/** What the student sees. Never says which notes are real requirements, which conflict or what the right owners are. */
export interface BusinessDocsContent {
  company: string;
  /** per-check results would let repeated tries find the planted issues, so submissions are capped */
  maxSubmissions?: number;
  deliverable: string;
  notes: Note[];
  sections: SectionKey[];
  /** the people and teams that can own a step, a gap or a RACI letter */
  roles: string[];
  /** RACI rows (columns are `roles`) */
  raciTasks?: { id: string; label: string }[];
  /** the current process, for a gap analysis */
  asIs?: string[];
}

export type RaciLetter = "R" | "A" | "C" | "I";

/** Server-only. What the checks need to judge the document. */
export interface BusinessDocsKey {
  /** notes a story must cover; the story or its criteria must mention one of the keywords (lower case) */
  mustCover: { id: string; keywords: string[] }[];
  /** notes with no number in them: a criterion of a story covering it must contain one */
  vague: string[];
  contradiction?: [string, string];
  duplicate?: [string, string];
  /** steps the notes describe: some step (of this type) must mention a keyword and be owned by one of `owners` */
  requiredSteps?: { type: "task" | "decision"; keywords: string[]; owners: string[] }[];
  raciExpect?: { task: string; role: string; letter: RaciLetter }[];
  /** notes the current process does not meet */
  gaps?: string[];
  /** notes the current process already meets */
  met?: string[];
}

const id = z.string().trim().min(1).max(12);
const text = (max: number) => z.string().max(max);

export const BusinessDocsSubmissionSchema = z.object({
  stories: z.array(z.object({ id, text: text(400), covers: z.array(id).max(10), criteria: z.array(text(400)).max(8) })).max(15).default([]),
  issues: z.array(z.object({ kind: z.enum(["contradiction", "duplicate"]), refs: z.tuple([id, id]) })).max(10).default([]),
  tests: z.array(z.object({ id, title: text(200), covers: z.array(id).max(10) })).max(20).default([]),
  process: z
    .array(z.object({ id, label: text(120), type: z.enum(["start", "task", "decision", "end"]), owner: text(60), next: z.array(z.object({ to: id, label: text(40).default("") })).max(4) }))
    .max(25)
    .default([]),
  raci: z.record(id, z.record(text(60), z.enum(["R", "A", "C", "I", ""])).refine((r) => Object.keys(r).length <= 20)).refine((r) => Object.keys(r).length <= 20).default({}),
  gaps: z.array(z.object({ note: id, current: text(300), target: text(300), action: text(300), owner: text(60) })).max(12).default([]),
});
export type BusinessDocsSubmission = z.infer<typeof BusinessDocsSubmissionSchema>;
export type ProcessStep = BusinessDocsSubmission["process"][number];

export interface BusinessDocsTemplate {
  id: string;
  difficulty: Difficulty;
  minLevel: ExperienceLevel;
  areas: string[];
  title: string;
  requester: Requester;
  /** the stakeholder's message in their own voice */
  scenario: string;
  skillTags: string[];
  content: BusinessDocsContent;
  key: BusinessDocsKey;
  /** a document that passes every check (tests prove it); never shown */
  solution: z.input<typeof BusinessDocsSubmissionSchema>;
}
