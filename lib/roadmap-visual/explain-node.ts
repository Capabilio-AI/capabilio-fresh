import { scoreSkill, type EvidenceInput } from "./capability";
import { classifyCoverage, subjectPriorities, type NodeCoverage } from "./coverage";
import { derive } from "./graph-build";
import type { GraphContext, Resource, TemplateNodeRow } from "./graph-types";
import { explainScore, type ScoreExplanation } from "./explain";
import { IMPORTANCE_WEIGHT, ROLLUP_FORMULA, rollUp } from "./rollup";
import { isPrerequisitePending, nodeStatus, skipWarnings, type NodeStatus } from "./status";

export interface Link {
  key: string;
  title: string;
  status: NodeStatus;
  level: number | null;
  target: number | null;
}
export interface WhatIf {
  kind: "ARENA";
  resourceId: string;
  title: string;
  from: number | null;
  to: number;
}

/** The factual payload behind the topic panel. Built here from stored data; AI may narrate it but never changes it. */
export interface NodeExplanation {
  key: string;
  type: "SPINE" | "GROUP" | "TOPIC";
  title: string;
  description: string;
  importance: string;
  stage: string;
  status: NodeStatus;
  userState: "LEARNING" | "SKIPPED" | null;
  skipReason: string | null;
  whyThisCareer: string;
  /** topics only */
  score: ScoreExplanation | null;
  /** groups and stages: how the number is built from its topics */
  rollup: { formula: string; progress: number | null; evidenceCoverage: number | null; leaves: { key: string; title: string; weight: number; level: number | null; target: number; contribution: number }[] } | null;
  college: NodeCoverage & { curriculum: GraphContext["curriculum"]["state"]; message: string | null };
  prerequisites: Link[];
  unlocks: Link[];
  needsCheck: string | null;
  skipWarnings: string[];
  resources: { free: Resource[]; premium: Resource[]; none: boolean };
  practice: { arena: Resource[]; projects: Resource[]; certifications: Resource[] };
  whatIf: WhatIf[];
}

const COLLEGE_MESSAGE: Record<GraphContext["curriculum"]["state"], string | null> = {
  PUBLISHED: null,
  NONE: "Your college hasn't published a curriculum for your branch yet, so we can't say how it covers this.",
  REGULATION_MISMATCH: "A curriculum exists for your branch but not for your regulation, so we can't say how it covers this.",
  NO_BRANCH: "Add your branch to see how your college curriculum covers this.",
};

function link(ctx: GraphContext, d: ReturnType<typeof derive>, key: string): Link {
  const n = d.byKey.get(key)!;
  const level = d.level.get(key) ?? null;
  const user = ctx.userStates.get(key);
  return { key, title: n.title, level, target: n.target, status: n.type === "TOPIC" ? nodeStatus({ level, targetLevel: n.target ?? 0, userState: user?.status ?? null, needsCheck: d.flags.has(key), locked: false }) : "NOT_ASSESSED" };
}

export function statusOf(ctx: GraphContext, d: ReturnType<typeof derive>, n: TemplateNodeRow): NodeStatus {
  const level = d.level.get(n.key) ?? null;
  const user = ctx.userStates.get(n.key);
  const locked = (d.prereqOf.get(n.key) ?? []).some((p) => isPrerequisitePending({ level: d.level.get(p) ?? null, targetLevel: d.byKey.get(p)?.target ?? 0, userState: ctx.userStates.get(p)?.status ?? null }));
  return nodeStatus({ level, targetLevel: n.target ?? 0, userState: user?.status ?? null, needsCheck: d.flags.has(n.key), locked: locked && level === null && !user });
}

export function explainNode(ctx: GraphContext, key: string): NodeExplanation | null {
  const d = derive(ctx);
  const n = d.byKey.get(key);
  if (!n) return null;
  const topic = n.type === "TOPIC";
  const status = topic ? statusOf(ctx, d, n) : "NOT_ASSESSED";
  const user = ctx.userStates.get(key);
  const score = n.skillId ? ctx.scores.get(n.skillId) ?? null : null;
  const pos = { year: ctx.position.year, semester: ctx.position.semester };

  const coverage: NodeCoverage = topic && n.skillId ? classifyCoverage(n.skillId, ctx.curriculum.courses, pos, ctx.inferredThreshold) : { state: "UNKNOWN", basis: null, items: [], unknownReason: null };

  let rollup: NodeExplanation["rollup"] = null;
  if (!topic) {
    const tree = ctx.nodes.map((x) => ({ key: x.key, parentKey: x.parentKey, type: x.type, importance: x.importance, targetLevel: x.target }));
    const r = rollUp(tree, new Map([...d.level].map(([k, v]) => [k, { level: v }]))).get(key)!;
    const under = (k: string): TemplateNodeRow[] => ctx.nodes.filter((x) => x.parentKey === k).flatMap((x) => (x.type === "TOPIC" ? [x] : under(x.key)));
    rollup = {
      formula: ROLLUP_FORMULA, progress: r.progress, evidenceCoverage: r.evidenceCoverage,
      leaves: under(key).map((l) => {
        const level = d.level.get(l.key) ?? null;
        const w = IMPORTANCE_WEIGHT[l.importance];
        return { key: l.key, title: l.title, weight: w, level, target: l.target ?? 0, contribution: Math.round(w * Math.min(1, (level ?? 0) / Math.max(1, l.target ?? 100)) * 100) / 100 };
      }),
    };
  }

  const pool = [...(n.skillId ? ctx.resources.bySkill.get(n.skillId) ?? [] : []), ...(ctx.resources.byNode.get(key) ?? [])];
  const unique = [...new Map(pool.map((r) => [`${r.kind}:${r.id}`, r])).values()];
  const learning = unique.filter((r) => r.kind === "LEARNING");
  const hypothetical = (r: Resource): EvidenceInput => ({ kind: "ARENA", level: null, observedAt: ctx.now, difficulty: r.difficulty === "easy" || r.difficulty === "medium" || r.difficulty === "hard" ? r.difficulty : null, label: r.title });
  const base = n.skillId ? ctx.evidenceInputs.get(n.skillId) ?? [] : [];
  const whatIf: WhatIf[] = topic && n.skillId
    ? unique.filter((r) => r.kind === "ARENA").slice(0, 3).map((r) => ({ kind: "ARENA" as const, resourceId: r.id, title: r.title, from: score?.level ?? null, to: scoreSkill([...base, hypothetical(r)], ctx.now).level ?? 0 })).filter((w) => w.from === null || w.to > w.from)
    : [];

  return {
    key, type: n.type, title: n.title, description: n.description, importance: n.importance, stage: n.stage, status,
    userState: user?.status ?? null, skipReason: user?.reason ?? null,
    whyThisCareer: topic ? `${n.title} is ${n.importance === "CORE" ? "a core" : n.importance === "RECOMMENDED" ? "a recommended" : "an optional"} topic for ${ctx.career.name}, expected by the ${n.stage.toLowerCase().replace("_", "-")} stage.` : `${n.title} groups the topics a ${ctx.career.name} needs in this part of the path.`,
    score: topic && n.skillId ? explainScore({ skillName: n.skillName ?? n.title, score, targetLevel: n.target ?? 0, targetSource: n.targetSource, status }) : null,
    rollup,
    college: { ...coverage, curriculum: ctx.curriculum.state, message: COLLEGE_MESSAGE[ctx.curriculum.state] },
    prerequisites: (d.prereqOf.get(key) ?? []).map((k) => link(ctx, d, k)), unlocks: (d.unlocks.get(key) ?? []).map((k) => link(ctx, d, k)),
    needsCheck: d.flags.get(key) ?? null,
    skipWarnings: topic ? skipWarnings(key, ctx.edges.filter((e) => e.type === "PREREQUISITE"), (k) => d.byKey.get(k)?.title ?? k) : [],
    resources: { free: learning.filter((r) => r.tier === "FREE"), premium: learning.filter((r) => r.tier === "PREMIUM"), none: learning.length === 0 },
    practice: { arena: unique.filter((r) => r.kind === "ARENA"), projects: unique.filter((r) => r.kind === "PROJECT"), certifications: unique.filter((r) => r.kind === "CERTIFICATION") },
    whatIf,
  };
}

export interface ReadinessExplanation {
  formula: string;
  readiness: number;
  evidenceCoverage: number;
  stages: { key: string; title: string; progress: number | null; evidenceCoverage: number | null; topics: number; assessedTopics: number }[];
}

export function explainReadiness(ctx: GraphContext): ReadinessExplanation {
  const d = derive(ctx);
  const tree = ctx.nodes.map((x) => ({ key: x.key, parentKey: x.parentKey, type: x.type, importance: x.importance, targetLevel: x.target }));
  const r = rollUp(tree, new Map([...d.level].map(([k, v]) => [k, { level: v }])));
  const topics = ctx.nodes.filter((x) => x.type === "TOPIC");
  const all = rollUp([{ key: "$root", parentKey: null, type: "GROUP", importance: "CORE", targetLevel: null }, ...topics.map((t) => ({ key: t.key, parentKey: "$root", type: "TOPIC" as const, importance: t.importance, targetLevel: t.target }))], new Map([...d.level].map(([k, v]) => [k, { level: v }]))).get("$root")!;
  return {
    formula: `Readiness for ${ctx.career.name} = ${ROLLUP_FORMULA}`,
    readiness: all.progress ?? 0, evidenceCoverage: all.evidenceCoverage ?? 0,
    stages: ctx.nodes.filter((x) => x.type === "SPINE").sort((a, b) => a.order - b.order).map((s) => ({ key: s.key, title: s.title, ...r.get(s.key)! })),
  };
}

export function explainSubject(ctx: GraphContext, courseId: string) {
  const d = derive(ctx);
  const topics = ctx.nodes.filter((n) => n.type === "TOPIC" && n.skillId && n.target !== null).map((t) => ({ key: t.key, title: t.title, skillId: t.skillId!, importance: t.importance, target: t.target!, level: d.level.get(t.key) ?? null }));
  const all = subjectPriorities(ctx.curriculum.courses ?? [], topics, { year: ctx.position.year, semester: ctx.position.semester }, ctx.inferredThreshold);
  const subject = all.find((s) => s.courseId === courseId);
  const course = ctx.curriculum.courses?.find((c) => c.id === courseId) ?? null;
  if (!subject || !course) return null;
  return {
    subject, course: { id: course.id, title: course.title, code: course.code, year: course.year, semester: course.semester, pages: course.pages },
    rank: all.findIndex((s) => s.courseId === courseId) + 1, of: all.length,
    formula: "Subject priority = Σ topic weight × remaining gap share, over the career topics this subject teaches (core 3, recommended 2, optional 1; an unassessed topic counts as fully open). It ranks subjects only: every subject remains part of your degree.",
  };
}
