import { consistencyFlags } from "./consistency";
import { classifyCoverage, subjectPriorities } from "./coverage";
import { layoutRoadmap } from "./layout";
import { rollUp, type Importance } from "./rollup";
import { isPrerequisitePending, nodeStatus } from "./status";
import type { GraphContext, GraphEdge, GraphNode, Resource, RoadmapGraph, TemplateNodeRow } from "./graph-types";

export interface Derived {
  byKey: Map<string, TemplateNodeRow>;
  prereqOf: Map<string, string[]>;
  unlocks: Map<string, string[]>;
  level: Map<string, number | null>;
  flags: Map<string, string>;
}

/** Pure. The relations and flags every consumer (graph, panel, header) needs, computed once from the context. */
export function derive(ctx: GraphContext): Derived {
  const byKey = new Map(ctx.nodes.map((n) => [n.key, n]));
  const prereqOf = new Map<string, string[]>();
  const unlocks = new Map<string, string[]>();
  for (const e of ctx.edges) {
    if (e.type !== "PREREQUISITE") continue;
    prereqOf.set(e.to, [...(prereqOf.get(e.to) ?? []), e.from]);
    unlocks.set(e.from, [...(unlocks.get(e.from) ?? []), e.to]);
  }
  const level = new Map<string, number | null>();
  for (const n of ctx.nodes) if (n.type === "TOPIC" && n.skillId) level.set(n.key, ctx.scores.get(n.skillId)?.level ?? null);
  const flags = new Map<string, string>();
  const pairs = ctx.edges.filter((e) => e.type === "PREREQUISITE" && byKey.get(e.from)?.type === "TOPIC" && byKey.get(e.to)?.type === "TOPIC");
  for (const f of consistencyFlags(pairs, level, (k) => byKey.get(k)?.title ?? k)) if (!flags.has(f.nodeKey)) flags.set(f.nodeKey, f.message);
  return { byKey, prereqOf, unlocks, level, flags };
}

const headline = (c: NonNullable<ReturnType<typeof classifyCoverage>>): string | null => {
  const first = c.items[0];
  if (!first) return null;
  const when = first.semester ? `Semester ${(first.year - 1) * 2 + first.semester}` : `Year ${first.year}`;
  return `${first.title} · ${when}${c.items.length > 1 ? ` +${c.items.length - 1} more` : ""}`;
};

export const MAX_PROJECTS = 6;
export const MAX_CERTIFICATIONS = 5;
const WEIGHT = { CORE: 3, RECOMMENDED: 2, OPTIONAL: 1 } as const;

/**
 * Pure. Projects and certifications that build THIS career's topics: every catalog item linked to a topic's skill, ranked by how much of the career
 * (importance-weighted topics) it touches. Nothing is invented: an item appears only when the catalog links it to the tree's skills.
 */
export function careerExtras(ctx: GraphContext): { projects: Resource[]; certifications: Resource[] } {
  const score = new Map<string, { r: Resource; w: number }>();
  for (const n of ctx.nodes) {
    if (n.type !== "TOPIC" || !n.skillId) continue;
    for (const r of ctx.resources.bySkill.get(n.skillId) ?? []) {
      if (r.kind !== "PROJECT" && r.kind !== "CERTIFICATION") continue;
      const k = `${r.kind}:${r.id}`;
      score.set(k, { r, w: (score.get(k)?.w ?? 0) + WEIGHT[n.importance] });
    }
  }
  const top = (kind: Resource["kind"], max: number) => [...score.values()].filter((x) => x.r.kind === kind).sort((a, b) => b.w - a.w || a.r.title.localeCompare(b.r.title)).slice(0, max).map((x) => x.r);
  return { projects: top("PROJECT", MAX_PROJECTS), certifications: top("CERTIFICATION", MAX_CERTIFICATIONS) };
}

const PROVE = "x-prove";

/** Pure. The whole roadmap view, from the tree, the student's evidence, node state and the syllabus. */
export function buildGraph(ctx: GraphContext): RoadmapGraph {
  const d = derive(ctx);
  const extras = careerExtras(ctx);
  const finalOrder = Math.max(0, ...ctx.nodes.filter((n) => n.type === "SPINE").map((n) => n.order)) + 10;
  // the last stage of every map: build things and earn credentials that prove the topics above
  const proveSections = [
    { key: `${PROVE}-projects`, title: "Projects to build", side: "LEFT" as const, items: extras.projects },
    { key: `${PROVE}-certs`, title: "Certifications to earn", side: "RIGHT" as const, items: extras.certifications },
  ].filter((x) => x.items.length > 0);
  const layoutInputs = [
    ...ctx.nodes.map((n) => ({ key: n.key, parentKey: n.parentKey, type: n.type, side: n.side, order: n.order })),
    ...(proveSections.length ? [{ key: PROVE, parentKey: null, type: "SPINE" as const, side: "CENTER" as const, order: finalOrder }] : []),
    ...proveSections.flatMap((sec) => [
      { key: sec.key, parentKey: PROVE, type: "GROUP" as const, side: sec.side, order: 1 },
      ...sec.items.map((r, i) => ({ key: `${sec.key}-${i}`, parentKey: sec.key, type: "TOPIC" as const, side: sec.side, order: i })),
    ]),
  ];
  const layout = layoutRoadmap(layoutInputs);
  const scoreOf = (n: TemplateNodeRow) => (n.skillId ? ctx.scores.get(n.skillId) ?? null : null);
  const roll = rollUp(ctx.nodes.map((n) => ({ key: n.key, parentKey: n.parentKey, type: n.type, importance: n.importance, targetLevel: n.target })), new Map([...d.level].map(([k, v]) => [k, { level: v }])));

  const topics = ctx.nodes.filter((n) => n.type === "TOPIC" && n.skillId && n.target !== null);
  const pos = { year: ctx.position.year, semester: ctx.position.semester };
  const courses = ctx.curriculum.courses;

  const nodes: GraphNode[] = ctx.nodes.map((n) => {
    const score = scoreOf(n);
    const level = n.type === "TOPIC" ? score?.level ?? null : null;
    const user = ctx.userStates.get(n.key);
    const pending = (d.prereqOf.get(n.key) ?? []).some((p) => {
      const pn = d.byKey.get(p);
      return pn?.type === "TOPIC" && isPrerequisitePending({ level: d.level.get(p) ?? null, targetLevel: pn.target ?? 0, userState: ctx.userStates.get(p)?.status ?? null });
    });
    const needsCheck = d.flags.get(n.key) ?? null;
    const topic = n.type === "TOPIC";
    const r = roll.get(n.key)!;
    const cov = topic && n.skillId ? classifyCoverage(n.skillId, courses, pos, ctx.inferredThreshold) : null;
    const pool = [...(n.skillId ? ctx.resources.bySkill.get(n.skillId) ?? [] : []), ...(ctx.resources.byNode.get(n.key) ?? [])];
    const count = (k: string) => new Set(pool.filter((x) => x.kind === k).map((x) => x.id)).size;
    return {
      key: n.key, id: n.id, type: n.type, parentKey: n.parentKey, title: n.title, description: n.description, stage: n.stage, side: n.side, importance: n.importance,
      skill: n.skillId && n.skillName ? { id: n.skillId, name: n.skillName } : null, target: n.target, level,
      confidence: score && score.evidenceCount > 0 ? score.confidence : null, verified: score?.verified ?? false,
      status: topic ? nodeStatus({ level, targetLevel: n.target ?? 0, userState: user?.status ?? null, needsCheck: Boolean(needsCheck), locked: pending && level === null && !user }) : "NOT_ASSESSED",
      userState: user?.status ?? null, skipReason: user?.reason ?? null,
      progress: topic ? null : r.progress, evidenceCoverage: topic ? null : r.evidenceCoverage, topics: r.topics, assessedTopics: r.assessedTopics,
      needsCheck, locked: pending, coverage: cov ? { state: cov.state, basis: cov.basis, headline: headline(cov), courses: cov.items.length } : null,
      practice: { arena: count("ARENA"), projects: count("PROJECT"), certifications: count("CERTIFICATION"), learning: count("LEARNING") },
      prerequisites: d.prereqOf.get(n.key) ?? [], unlocks: d.unlocks.get(n.key) ?? [], resource: null, box: layout.boxes[n.key] ?? { x: 0, y: 0, w: 0, h: 0 },
    };
  });

  const blank = (over: Partial<GraphNode> & Pick<GraphNode, "key" | "type" | "title">): GraphNode => ({
    id: over.key, parentKey: null, description: "", stage: "JOB_READY", side: "CENTER", importance: "RECOMMENDED", skill: null, target: null, level: null, confidence: null, verified: false, status: "NOT_ASSESSED", userState: null, skipReason: null,
    progress: null, evidenceCoverage: null, topics: 0, assessedTopics: 0, needsCheck: null, locked: false, coverage: null, practice: { arena: 0, projects: 0, certifications: 0, learning: 0 }, prerequisites: [], unlocks: [], resource: null, box: layout.boxes[over.key] ?? { x: 0, y: 0, w: 0, h: 0 }, ...over,
  });
  if (proveSections.length) {
    nodes.push(blank({ key: PROVE, type: "SPINE", title: "Build and prove it", description: "Projects to build and certifications to earn for this career." }));
    for (const sec of proveSections) {
      nodes.push(blank({ key: sec.key, type: "GROUP", title: sec.title, parentKey: PROVE, side: sec.side }));
      sec.items.forEach((r, i) => nodes.push(blank({ key: `${sec.key}-${i}`, type: "TOPIC", title: r.title, parentKey: sec.key, side: sec.side, resource: r, description: r.description ?? "" })));
    }
  }

  const spines = ctx.nodes.filter((n) => n.type === "SPINE").sort((a, b) => a.order - b.order);
  const spineKeys = [...spines.map((x) => x.key), ...(proveSections.length ? [PROVE] : [])];
  const edges: GraphEdge[] = [
    ...spineKeys.slice(1).map((k, i): GraphEdge => ({ id: `next-${spineKeys[i]}-${k}`, from: spineKeys[i], to: k, kind: "SPINE_NEXT" })),
    ...nodes.filter((n) => n.type === "GROUP").map((g): GraphEdge => ({ id: `grp-${g.key}`, from: g.parentKey!, to: g.key, kind: "SPINE_GROUP" })),
    ...nodes.filter((n) => n.type === "TOPIC").map((t): GraphEdge => ({ id: `br-${t.key}`, from: t.parentKey!, to: t.key, kind: "GROUP_TOPIC" })),
  ];

  // overall numbers: every topic of the tree, importance-weighted
  const all = rollUp([{ key: "$root", parentKey: null, type: "GROUP", importance: "CORE", targetLevel: null }, ...topics.map((t) => ({ key: t.key, parentKey: "$root", type: "TOPIC" as const, importance: t.importance, targetLevel: t.target }))], new Map([...d.level].map(([k, v]) => [k, { level: v }]))).get("$root")!;
  const analysed = courses ? courses.filter((c) => c.analysed).length : null;

  return {
    state: "READY", career: ctx.career, template: ctx.template,
    header: {
      readiness: all.progress ?? 0, evidenceCoverage: all.evidenceCoverage ?? 0, assessedTopics: all.assessedTopics, totalTopics: all.topics, position: ctx.position,
      curriculum: { state: ctx.curriculum.state, versionNo: ctx.curriculum.versionNo, regulation: ctx.curriculum.regulation, branch: ctx.curriculum.branch, analysed: analysed === null || !courses?.length ? null : analysed === courses.length },
    },
    nodes, edges, bounds: layout.bounds,
    subjects: courses ? subjectPriorities(courses, topics.map((t) => ({ key: t.key, title: t.title, skillId: t.skillId!, importance: t.importance as Importance, target: t.target!, level: d.level.get(t.key) ?? null })), pos, ctx.inferredThreshold) : [],
    overlay: { inferredShown: true, inferredThreshold: ctx.inferredThreshold }, tiers: ["OFFICIAL", "INFERRED"],
  };
}
