import { z } from "zod";
import type { Resource } from "./graph-types";
import { DatasetSpec } from "./dataset";

export const GuideBody = z.object({ resourceId: z.string().uuid(), career: z.enum(["primary", "plan-b"]).default("primary") }).strict();

/** The written guide. No transforms anywhere: the AI layer turns this schema into JSON Schema before it calls the model, and a transform cannot be converted. */
export const ProjectGuide = z.object({
  overview: z.string().max(700),
  outcome: z.string().max(300),
  estimatedHours: z.number().min(1).max(200).nullable().default(null),
  /** the situation the student is working in, like a real brief from a team */
  scenario: z.string().max(600).default(""),
  /** the questions the finished work must answer */
  questions: z.array(z.string().max(220)).max(6).default([]),
  tools: z.array(z.string().max(60)).max(8).default([]),
  steps: z.array(z.object({ title: z.string().max(100), detail: z.string().max(500), deliverable: z.string().max(200) })).min(4).max(9),
  skillsGained: z.array(z.object({ skill: z.string().max(80), how: z.string().max(220) })).min(1).max(8),
  showcase: z.array(z.string().max(200)).max(5).default([]),
  /** "you are done when": checks the student can tick off honestly */
  checklist: z.array(z.string().max(200)).max(8).default([]),
  pitfalls: z.array(z.string().max(220)).max(4).default([]),
});
export type ProjectGuide = z.infer<typeof ProjectGuide>;

/** Practice data for the project, asked for in its own call so a problem with it can never cost the student the guide. */
export const ProjectData = z.object({
  datasets: z.array(DatasetSpec).max(3).default([]),
  /** search ideas for real data, never links */
  realDataIdeas: z.array(z.string().max(160)).max(3).default([]),
});
export type ProjectData = z.infer<typeof ProjectData>;

/** What the project panel shows: the guide and its data together. */
export type ProjectGuideView = ProjectGuide & ProjectData;

const DATASET_RULES = [
  "If the project works with data (analysis, cleaning, SQL, dashboards, ML, reporting), give 1 to 3 \"datasets\" the student will practise on, because the student has NO data of their own. Otherwise return \"datasets\": [].",
  'Each dataset: {"name": snake_case table name, "description": one sentence, "rows": 50-400, "columns": [{"name", "type": "id"|"integer"|"number"|"category"|"date"|"boolean", "description", plus as needed: "min","max" (numbers), "choices" (category, up to 12 short values), "from_date","to_date" (date, ISO), "from" (name of an EARLIER numeric column this one follows) with "factor","offset","noise" (the relationship the project is meant to discover), "ref" ("othertable.id_column", an EARLIER table), "missingRate" 0-0.2 (only when the project is about cleaning or missing values)}]} with 3-10 columns, realistic for the project.',
  'Put the relationship the project is about into the columns (for example strength rising with curing days). "realDataIdeas": up to 3 plain-text ideas for finding real public data (a topic and where such data is usually published), never URLs.',
].join(" ");

export const DATA_SYSTEM = [
  "You design small practice datasets for student portfolio projects. The student has no data of their own, so the tables you describe are all they start from.",
  "You only DESCRIBE tables (columns, ranges, relations); a program generates the rows. Respond with JSON only; plain text; no links.",
].join(" ");

export const GUIDE_SYSTEM = [
  "You write practical step-by-step build guides for student portfolio projects on Capabilio's career roadmap.",
  "Ground everything in the project description and skills given. Plain text only; no markdown, no links, no invented tools that are not needed.",
  "Each step is one concrete action the student can finish in a sitting, ending in a visible deliverable (a running command, a screenshot, a commit).",
  "Do not claim the guide grades, certifies, or changes the student's scores; only evidence from real work does that.",
  "Respond with JSON only.",
].join(" ");

/** Pure. The prompt is built from stored resource fields only; nothing the student typed reaches it. */
export function buildGuidePrompt(r: Resource, careerName: string): string {
  return [
    careerName ? `Career: ${careerName}` : "",
    `Project: ${r.title}${r.difficulty ? ` (${r.difficulty.toLowerCase()})` : ""}${r.hours ? `, about ${r.hours} hours` : ""}`,
    r.description ? `Description: ${r.description}` : "",
    r.skills.length ? `Roadmap skills it builds: ${r.skills.join(", ")}` : "",
    r.evidence.length ? `What to show when finished:\n- ${r.evidence.join("\n- ")}` : "",
    'Return JSON: {"overview": string, "outcome": string, "estimatedHours": number|null, "steps": [{"title","detail","deliverable"}] (5-8 steps), "skillsGained": [{"skill","how"}] (use the roadmap skill names above where they apply), "scenario": string (2-3 sentences: who needs this and why, like a brief from a real team), "questions": string[] (3-6 questions the work must answer), "tools": string[] (what to install or open), "showcase": string[], "checklist": string[] (5-8 honest "you are done when" checks), "pitfalls": string[]}.',
  ].filter(Boolean).join("\n\n");
}

/** Pure. The prompt for the practice-data call, from the same stored resource fields. Returns empty datasets for projects that do not use data. */
export function buildDataPrompt(r: Resource, careerName: string): string {
  return [
    careerName ? `Career: ${careerName}` : "",
    `Project: ${r.title}${r.difficulty ? ` (${r.difficulty.toLowerCase()})` : ""}`,
    r.description ? `Description: ${r.description}` : "",
    r.skills.length ? `Roadmap skills it builds: ${r.skills.join(", ")}` : "",
    DATASET_RULES,
    'Return JSON: {"datasets": [...], "realDataIdeas": string[]}.',
  ].filter(Boolean).join("\n\n");
}

/** Finds a resource by id in the already-loaded pool. */
export function findResource(pool: { bySkill: Map<string, Resource[]>; byNode: Map<string, Resource[]> }, id: string): Resource | null {
  for (const m of [pool.bySkill, pool.byNode]) for (const list of m.values()) { const r = list.find((x) => x.id === id); if (r) return r; }
  return null;
}
