import type { GraphEdge, GraphNode } from "./graph-types";
import { layoutRoadmap, type Box, type LayoutInput } from "./layout";
import type { SubjectNode } from "./syllabus-map";

export const SEP = "::";
/** A topic node's key is `${courseId}::${roadmapNodeKey}`, because one topic can be taught by several subjects. */
export const roadmapKeyOf = (key: string) => (key.includes(SEP) ? key.slice(key.indexOf(SEP) + SEP.length) : null);

export interface FocusSubject {
  courseId: string;
  title: string;
  semesterLabel: string;
  toProve: number;
  timing: SubjectNode["timing"];
}

export interface SubjectsTree {
  nodes: GraphNode[];
  edges: GraphEdge[];
  bounds: Box;
  focus: FocusSubject[];
  /** subjects that teach none of this career's topics: still part of the degree, not drawn */
  untracked: number;
}

const FOCUS_MAX = 3;
const termNo = (s: SubjectNode) => (s.semester ? (s.year - 1) * 2 + s.semester : s.year);
const termLabel = (s: SubjectNode) => (s.semester ? `Semester ${termNo(s)}` : `Year ${s.year}`);
const CAPTION = { COMPLETED: "Completed", CURRENT: "This semester", UPCOMING: "Coming up", UNKNOWN: "" } as const;

function node(over: Partial<GraphNode> & Pick<GraphNode, "key" | "type" | "title">): GraphNode {
  return {
    id: over.key, parentKey: null, description: "", stage: "FOUNDATION", side: "CENTER", importance: "RECOMMENDED", skill: null, target: null, level: null, confidence: null,
    verified: false, status: "NOT_ASSESSED", userState: null, skipReason: null, progress: null, evidenceCoverage: null, topics: 0, assessedTopics: 0, needsCheck: null, locked: false,
    coverage: null, practice: { arena: 0, projects: 0, certifications: 0, learning: 0 }, prerequisites: [], unlocks: [], resource: null, box: { x: 0, y: 0, w: 0, h: 0 }, ...over,
  };
}

const topicStatus = (t: { level: number | null; met: boolean }): GraphNode["status"] => (t.met ? "TARGET_MET" : t.level === null ? "NOT_ASSESSED" : t.level > 0 ? "LEARNING" : "NOT_STARTED");

/**
 * Pure. The student's syllabus as a tree: semesters down the trunk, the subjects of each semester branching off it, and the career topics each
 * subject teaches as the stations. Status comes from the same evidence as the roadmap; nothing can be marked by hand.
 */
export function buildSubjectsTree(syllabus: SubjectNode[]): SubjectsTree {
  const tracked = syllabus.filter((s) => s.topics.length > 0);
  const terms = new Map<number, SubjectNode[]>();
  for (const s of tracked) terms.set(termNo(s), [...(terms.get(termNo(s)) ?? []), s]);
  const ordered = [...terms.entries()].sort((a, b) => a[0] - b[0]);

  const nodes: GraphNode[] = [];
  const edges: GraphEdge[] = [];
  const layout: LayoutInput[] = [];
  let prev: string | null = null;

  ordered.forEach(([, subjects], ti) => {
    const first = subjects[0];
    const key = `term-${termNo(first)}`;
    const topics = subjects.reduce((n, s) => n + s.topics.length, 0);
    const proven = subjects.reduce((n, s) => n + s.provenCount, 0);
    const timing = subjects.some((s) => s.timing === "CURRENT") ? "CURRENT" : first.timing;
    nodes.push(node({ key, type: "SPINE", title: termLabel(first), description: CAPTION[timing], topics, assessedTopics: proven }));
    layout.push({ key, parentKey: null, type: "SPINE", side: "CENTER", order: ti });
    if (prev) edges.push({ id: `${prev}>${key}`, from: prev, to: key, kind: "SPINE_NEXT" });
    prev = key;

    subjects.forEach((s, si) => {
      const gKey = `sub-${s.courseId}`;
      const side = si % 2 === 0 ? "LEFT" : "RIGHT";
      nodes.push(node({ key: gKey, type: "GROUP", title: s.title, parentKey: key, side, topics: s.topics.length, assessedTopics: s.provenCount }));
      layout.push({ key: gKey, parentKey: key, type: "GROUP", side, order: si });
      edges.push({ id: `${key}>${gKey}`, from: key, to: gKey, kind: "SPINE_GROUP" });
      s.topics.forEach((t, k) => {
        const tKey = `${s.courseId}${SEP}${t.nodeKey}`;
        nodes.push(node({ key: tKey, type: "TOPIC", title: t.title, parentKey: gKey, side, level: t.level, target: t.target, status: topicStatus(t) }));
        layout.push({ key: tKey, parentKey: gKey, type: "TOPIC", side, order: k });
        edges.push({ id: `${gKey}>${tKey}`, from: gKey, to: tKey, kind: "GROUP_TOPIC" });
      });
    });
  });

  const placed = layoutRoadmap(layout);
  for (const n of nodes) n.box = placed.boxes[n.key] ?? n.box;

  const now = tracked
    .filter((s) => s.provenCount < s.topics.length && (s.timing === "CURRENT" || s.timing === "UPCOMING"))
    .sort((a, b) => Number(b.timing === "CURRENT") - Number(a.timing === "CURRENT") || termNo(a) - termNo(b));
  const revisit = tracked.filter((s) => s.provenCount < s.topics.length && s.timing === "COMPLETED").sort((a, b) => b.topics.length - b.provenCount - (a.topics.length - a.provenCount));
  const focus = [...now, ...revisit].slice(0, FOCUS_MAX).map((s) => ({ courseId: s.courseId, title: s.title, semesterLabel: termLabel(s), toProve: s.topics.length - s.provenCount, timing: s.timing }));

  return { nodes, edges, bounds: placed.bounds, focus, untracked: syllabus.length - tracked.length };
}
