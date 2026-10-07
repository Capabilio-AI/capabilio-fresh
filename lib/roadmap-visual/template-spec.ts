import { z } from "zod";
import { specHash } from "@/lib/arena-content/hash";
import { validateTemplateGraph, type SkillCatalog, type TemplateEdgeSpec, type TemplateNodeSpec } from "./template-validate";

const key = z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/);

export const TemplateNode = z.object({
  key,
  parent: key.nullable(),
  type: z.enum(["SPINE", "GROUP", "TOPIC"]),
  title: z.string().min(1).max(120),
  description: z.string().min(10).max(1200),
  /** canonical skill NAME; required for topics */
  skill: z.string().min(1).nullable().default(null),
  importance: z.enum(["CORE", "RECOMMENDED", "OPTIONAL"]).default("CORE"),
  target: z.number().int().min(0).max(100).nullable().default(null),
  stage: z.enum(["FOUNDATION", "CORE", "SPECIALIZATION", "JOB_READY"]),
  side: z.enum(["LEFT", "RIGHT", "CENTER"]),
  order: z.number().int().min(0).max(1000),
});
export const TemplateEdge = z.object({ from: key, to: key, type: z.enum(["PREREQUISITE", "CONNECTOR", "OPTIONAL_PATH"]).default("PREREQUISITE") });

/** A roadmap topic tree as authored: data, reviewed by a person, never code. */
export const TemplateSpecSchema = z.object({
  /** career key, e.g. "data-analyst" */
  career: z.string().min(2),
  version: z.number().int().min(1),
  title: z.string().min(3).max(160),
  description: z.string().max(1000).optional(),
  /** how this tree was designed. Required: every template records that it is original and how it was derived. */
  provenance: z.object({ designedBy: z.string().min(2), method: z.string().min(10), notes: z.string().optional() }),
  nodes: z.array(TemplateNode).min(3),
  edges: z.array(TemplateEdge).default([]),
});
export type TemplateSpec = z.infer<typeof TemplateSpecSchema>;

/** Order of nodes and edges in the file is not meaningful, so the hash sorts them: the same tree always hashes the same. */
export const templateHash = (spec: TemplateSpec): string =>
  specHash({
    ...spec,
    nodes: [...spec.nodes].sort((a, b) => (a.key < b.key ? -1 : 1)),
    edges: [...spec.edges].sort((a, b) => `${a.from}|${a.to}|${a.type}`.localeCompare(`${b.from}|${b.to}|${b.type}`)),
  });

export const toGraph = (spec: TemplateSpec): { nodes: TemplateNodeSpec[]; edges: TemplateEdgeSpec[] } => ({
  nodes: spec.nodes.map((n) => ({ key: n.key, parentKey: n.parent, type: n.type, title: n.title, description: n.description, skill: n.skill, importance: n.importance, targetLevel: n.target, stage: n.stage, side: n.side, order: n.order })),
  edges: spec.edges,
});

export interface TemplateReference {
  skills: SkillCatalog;
  /** career key -> id */
  careers: ReadonlyMap<string, string>;
}

/** Pure. Everything that must hold before a template is saved: schema, the career exists, and the graph rules (canonical skills only, no cycles, ...). */
export function validateTemplateSpec(input: unknown, ref: TemplateReference, opts: { allowPendingSkills?: boolean } = {}): { ok: boolean; spec: TemplateSpec | null; errors: string[]; warnings: string[] } {
  const parsed = TemplateSpecSchema.safeParse(input);
  if (!parsed.success) return { ok: false, spec: null, errors: parsed.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`), warnings: [] };
  const spec = parsed.data;
  const errors: string[] = [];
  if (!ref.careers.has(spec.career)) errors.push(`Unknown career "${spec.career}".`);
  const graph = toGraph(spec);
  const g = validateTemplateGraph(graph.nodes, graph.edges, ref.skills, opts);
  errors.push(...g.errors);
  const warnings = [...g.warnings];
  const empty = spec.nodes.filter((n) => n.type === "TOPIC" && !n.description.trim());
  if (empty.length) errors.push(`${empty.length} topic(s) have no description.`);
  return { ok: errors.length === 0, spec, errors, warnings };
}
