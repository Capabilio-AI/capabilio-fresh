import { z } from "zod";
import type { Resource } from "./graph-types";

export const GuideBody = z.object({ resourceId: z.string().uuid(), career: z.enum(["primary", "plan-b"]).default("primary") }).strict();

export const ProjectGuide = z.object({
  overview: z.string().max(700),
  outcome: z.string().max(300),
  estimatedHours: z.number().min(1).max(200).nullable().default(null),
  steps: z.array(z.object({ title: z.string().max(100), detail: z.string().max(500), deliverable: z.string().max(200) })).min(4).max(9),
  skillsGained: z.array(z.object({ skill: z.string().max(80), how: z.string().max(220) })).min(1).max(8),
  showcase: z.array(z.string().max(200)).max(5).default([]),
  pitfalls: z.array(z.string().max(220)).max(4).default([]),
});
export type ProjectGuide = z.infer<typeof ProjectGuide>;

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
    'Return JSON: {"overview": string, "outcome": string, "estimatedHours": number|null, "steps": [{"title","detail","deliverable"}] (5-8 steps), "skillsGained": [{"skill","how"}] (use the roadmap skill names above where they apply), "showcase": string[], "pitfalls": string[]}.',
  ].filter(Boolean).join("\n\n");
}

/** Finds a resource by id in the already-loaded pool. */
export function findResource(pool: { bySkill: Map<string, Resource[]>; byNode: Map<string, Resource[]> }, id: string): Resource | null {
  for (const m of [pool.bySkill, pool.byNode]) for (const list of m.values()) { const r = list.find((x) => x.id === id); if (r) return r; }
  return null;
}
