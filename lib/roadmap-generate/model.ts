import { z } from "zod";
import { TemplateEdge, TemplateNode } from "@/lib/roadmap-visual/template-spec";
import { ExtrasSpec } from "@/lib/roadmap-visual/resource-import";

/** What the model returns for a roadmap: the tree, plus the few skills the taxonomy lacks (each must hang under an existing skill). */
export const RoadmapAnswer = z.object({
  title: z.string().min(3).max(160),
  description: z.string().max(1000).optional(),
  newSkills: z.array(z.object({ name: z.string().min(2).max(100), parent: z.string().min(1), description: z.string().min(20).max(300) })).max(60).default([]),
  nodes: z.array(TemplateNode.omit({ skill: true }).extend({ skill: z.string().min(1).nullable().default(null) })).min(3).max(220),
  edges: z.array(TemplateEdge).max(600).default([]),
});
export type RoadmapAnswer = z.infer<typeof RoadmapAnswer>;

export const ExtrasAnswer = ExtrasSpec;

const str = { type: "string" };
const int = { type: "integer" };

export const ROADMAP_TOOL_SCHEMA = {
  type: "object",
  required: ["title", "nodes", "edges"],
  properties: {
    title: str,
    description: str,
    newSkills: { type: "array", items: { type: "object", required: ["name", "parent", "description"], properties: { name: str, parent: str, description: str } } },
    nodes: {
      type: "array",
      items: {
        type: "object",
        required: ["key", "parent", "type", "title", "description", "stage", "side", "order"],
        properties: {
          key: str, parent: { type: ["string", "null"] }, type: { enum: ["SPINE", "GROUP", "TOPIC"] }, title: str, description: str, skill: { type: ["string", "null"] },
          importance: { enum: ["CORE", "RECOMMENDED", "OPTIONAL"] }, target: { type: ["integer", "null"] }, stage: { enum: ["FOUNDATION", "CORE", "SPECIALIZATION", "JOB_READY"] },
          side: { enum: ["LEFT", "RIGHT", "CENTER"] }, order: int,
        },
      },
    },
    edges: { type: "array", items: { type: "object", required: ["from", "to"], properties: { from: str, to: str, type: { enum: ["PREREQUISITE", "CONNECTOR", "OPTIONAL_PATH"] } } } },
  },
} as const;

export const EXTRAS_TOOL_SCHEMA = {
  type: "object",
  required: ["projects", "certifications"],
  properties: {
    projects: { type: "array", items: { type: "object", required: ["title", "difficulty", "description", "evidence", "skills"], properties: { title: str, difficulty: { enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] }, description: str, evidence: { type: "array", items: str }, skills: { type: "array", items: str } } } },
    certifications: { type: "array", items: { type: "object", required: ["name", "provider", "url", "difficulty", "skills"], properties: { name: str, provider: str, url: str, difficulty: { enum: ["BEGINNER", "INTERMEDIATE", "ADVANCED"] }, skills: { type: "array", items: str } } } },
  },
} as const;
