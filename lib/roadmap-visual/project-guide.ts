import { z } from "zod";
import type { Resource } from "./graph-types";
import { DatasetSpec } from "./dataset";

export const GuideBody = z.object({ resourceId: z.string().uuid(), career: z.enum(["primary", "plan-b"]).default("primary") }).strict();

export const ProjectGuide = z.object({
  overview: z.string().max(700),
  outcome: z.string().max(300),
  estimatedHours: z.number().min(1).max(200).nullable().default(null),
  steps: z.array(z.object({ title: z.string().max(100), detail: z.string().max(500), deliverable: z.string().max(200) })).min(4).max(9),
  skillsGained: z.array(z.object({ skill: z.string().max(80), how: z.string().max(220) })).min(1).max(8),
  showcase: z.array(z.string().max(200)).max(5).default([]),
  pitfalls: z.array(z.string().max(220)).max(4).default([]),
  /** practice data the student can download; a table the AI described badly is dropped rather than failing the whole guide */
  datasets: z
    .array(z.unknown())
    .max(3)
    .default([])
    .transform((list) => list.flatMap((x) => { const p = DatasetSpec.safeParse(x); return p.success ? [p.data] : []; })),
  /** search ideas for real data, never links */
  realDataIdeas: z.array(z.string().max(160)).max(3).default([]),
});
export type ProjectGuide = z.infer<typeof ProjectGuide>;

const DATASET_RULES = [
  "If the project works with data (analysis, cleaning, SQL, dashboards, ML, reporting), give 1 to 3 \"datasets\" the student will practise on, because the student has NO data of their own. Otherwise return \"datasets\": [].",
  'Each dataset: {"name": snake_case table name, "description": one sentence, "rows": 50-400, "columns": [{"name", "type": "id"|"integer"|"number"|"category"|"date"|"boolean", "description", plus as needed: "min","max" (numbers), "choices" (category, up to 12 short values), "from_date","to_date" (date, ISO), "from" (name of an EARLIER numeric column this one follows) with "factor","offset","noise" (the relationship the project is meant to discover), "ref" ("othertable.id_column", an EARLIER table), "missingRate" 0-0.2 (only when the project is about cleaning or missing values)}]} with 3-10 columns, realistic for the project.',
  'Put the relationship the project is about into the columns (for example strength rising with curing days). "realDataIdeas": up to 3 plain-text ideas for finding real public data (a topic and where such data is usually published), never URLs.',
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
    `Career: ${careerName}`,
    `Project: ${r.title}${r.difficulty ? ` (${r.difficulty.toLowerCase()})` : ""}${r.hours ? `, about ${r.hours} hours` : ""}`,
    r.description ? `Description: ${r.description}` : "",
    r.skills.length ? `Roadmap skills it builds: ${r.skills.join(", ")}` : "",
    r.evidence.length ? `What to show when finished:\n- ${r.evidence.join("\n- ")}` : "",
    'Return JSON: {"overview": string, "outcome": string, "estimatedHours": number|null, "steps": [{"title","detail","deliverable"}] (5-8 steps), "skillsGained": [{"skill","how"}] (use the roadmap skill names above where they apply), "showcase": string[], "pitfalls": string[], "datasets": [...], "realDataIdeas": string[]}.',
    DATASET_RULES,
  ].filter(Boolean).join("\n\n");
}

/** Finds a resource by id in the already-loaded pool. */
export function findResource(pool: { bySkill: Map<string, Resource[]>; byNode: Map<string, Resource[]> }, id: string): Resource | null {
  for (const m of [pool.bySkill, pool.byNode]) for (const list of m.values()) { const r = list.find((x) => x.id === id); if (r) return r; }
  return null;
}
