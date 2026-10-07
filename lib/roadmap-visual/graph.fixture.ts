import { scoreSkill, type EvidenceInput } from "./capability";
import type { CurriculumCourse } from "./coverage";
import type { GraphContext, Resource, TemplateNodeRow } from "./graph-types";

export const NOW = new Date("2026-10-07T00:00:00Z");
const node = (over: Partial<TemplateNodeRow> & Pick<TemplateNodeRow, "key" | "type">): TemplateNodeRow => ({ id: `id-${over.key}`, parentKey: null, title: over.key, description: "desc", skillId: null, skillName: null, importance: "CORE", target: null, targetSource: "Capabilio design", stage: "FOUNDATION", side: "LEFT", order: 1, ...over });

export const NODES: TemplateNodeRow[] = [
  node({ key: "stage-a", type: "SPINE", title: "Stage A", side: "CENTER", order: 10 }),
  node({ key: "stage-b", type: "SPINE", title: "Stage B", side: "CENTER", order: 20, stage: "CORE" }),
  node({ key: "g-a", type: "GROUP", parentKey: "stage-a", title: "Group A", side: "LEFT" }),
  node({ key: "g-b", type: "GROUP", parentKey: "stage-b", title: "Group B", side: "RIGHT", stage: "CORE" }),
  node({ key: "sql", type: "TOPIC", parentKey: "g-a", title: "SQL", skillId: "s-sql", skillName: "SQL", target: 80, targetSource: "Data Analyst career requirement" }),
  node({ key: "joins", type: "TOPIC", parentKey: "g-a", title: "Joins", skillId: "s-joins", skillName: "SQL Joins", target: 60, order: 2 }),
  node({ key: "windows", type: "TOPIC", parentKey: "g-b", title: "Window functions", skillId: "s-win", skillName: "SQL Window Functions", target: 60, stage: "CORE", importance: "OPTIONAL", side: "RIGHT" }),
  node({ key: "stats", type: "TOPIC", parentKey: "g-b", title: "Statistics", skillId: "s-stats", skillName: "Statistics", target: 70, stage: "CORE", side: "RIGHT", order: 2 }),
];
export const EDGES: GraphContext["edges"] = [{ from: "sql", to: "joins", type: "PREREQUISITE" }, { from: "joins", to: "windows", type: "PREREQUISITE" }];

const ev = (kind: EvidenceInput["kind"], level: number | null, over: Partial<EvidenceInput> = {}): EvidenceInput => ({ kind, level, observedAt: NOW, label: kind, ...over });

export function makeContext(over: Partial<GraphContext> = {}, inputs: Record<string, EvidenceInput[]> = {}): GraphContext {
  const evidence = new Map(Object.entries(inputs));
  return {
    career: { id: "c1", key: "data-analyst", name: "Data Analyst" }, template: { id: "t1", version: 1, title: "Data Analyst roadmap", publishedAt: "2026-10-07" },
    nodes: NODES, edges: EDGES,
    scores: new Map([...evidence].map(([skill, list]) => [skill, scoreSkill(list, NOW)])), evidenceInputs: evidence,
    userStates: new Map(), curriculum: { state: "NONE", courses: null, versionNo: null, regulation: null, branch: "cse" },
    position: { year: 2, semester: 1, semesterEstimated: true, totalYears: 4 }, inferredThreshold: 0.8,
    resources: { bySkill: new Map(), byNode: new Map() }, now: NOW, ...over,
  };
}

export const course = (id: string, over: Partial<CurriculumCourse> = {}): CurriculumCourse => ({ id, title: `Course ${id}`, code: id.toUpperCase(), year: 2, semester: 1, pages: { start: 5, end: 6 }, analysed: true, units: [{ id: `${id}-u1`, no: 3, title: "Joins and subqueries" }], outcomes: [{ id: `${id}-o1`, code: "D1", text: "Write multi-table queries", source: "INFERRED" }], links: [], ...over });
export const resource = (over: Partial<Resource>): Resource => ({ id: "r1", kind: "LEARNING", title: "Docs", provider: "Provider", url: "https://example.org", type: "OFFICIAL", tier: "FREE", difficulty: null, hours: null, cost: null, note: null, description: null, evidence: [], skills: [], ...over });
