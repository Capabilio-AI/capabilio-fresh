import type { SkillScore, EvidenceInput } from "./capability";
import type { CurriculumCourse, NodeCoverage, SubjectPriority, Tier } from "./coverage";
import type { Box } from "./layout";
import type { Importance } from "./rollup";
import type { NodeStatus, UserNodeState } from "./status";
import type { SubjectNode } from "./syllabus-map";

export type Stage = "FOUNDATION" | "CORE" | "SPECIALIZATION" | "JOB_READY";

export interface TemplateNodeRow {
  id: string;
  key: string;
  parentKey: string | null;
  type: "SPINE" | "GROUP" | "TOPIC";
  title: string;
  description: string;
  skillId: string | null;
  skillName: string | null;
  importance: Importance;
  target: number | null;
  /** where the target comes from, shown in "Why this score" */
  targetSource: string;
  stage: Stage;
  side: "LEFT" | "RIGHT" | "CENTER";
  order: number;
}

export type ResourceType = "OFFICIAL" | "ARTICLE" | "VIDEO" | "COURSE" | "BOOK" | "PRACTICE";
export interface Resource {
  id: string;
  kind: "LEARNING" | "CERTIFICATION" | "PROJECT" | "ARENA";
  title: string;
  provider: string | null;
  /** external link (validated https) or an in-app path */
  url: string | null;
  type: ResourceType | null;
  tier: "FREE" | "PREMIUM";
  difficulty: string | null;
  hours: number | null;
  cost: string | null;
  note: string | null;
  /** projects: what to build and what to show; certifications: the programme in a line */
  description: string | null;
  evidence: string[];
  /** the roadmap skills it builds (names) */
  skills: string[];
}

export interface ResourcePool {
  /** by canonical skill id */
  bySkill: Map<string, Resource[]>;
  /** attached directly to a node by an editor */
  byNode: Map<string, Resource[]>;
}

export interface CurriculumContext {
  state: "PUBLISHED" | "NONE" | "REGULATION_MISMATCH" | "NO_BRANCH";
  courses: CurriculumCourse[] | null;
  versionNo: number | null;
  regulation: string | null;
  branch: string | null;
}

export interface Position {
  year: number | null;
  semester: number | null;
  semesterEstimated: boolean;
  totalYears: number | null;
}

export interface GraphContext {
  career: { id: string; key: string; name: string };
  template: { id: string; version: number; title: string; publishedAt: string | null };
  nodes: TemplateNodeRow[];
  edges: { from: string; to: string; type: "PREREQUISITE" | "CONNECTOR" | "OPTIONAL_PATH" }[];
  scores: ReadonlyMap<string, SkillScore>;
  evidenceInputs: ReadonlyMap<string, EvidenceInput[]>;
  userStates: ReadonlyMap<string, { status: Exclude<UserNodeState, null>; reason: string | null }>;
  curriculum: CurriculumContext;
  position: Position;
  inferredThreshold: number;
  resources: ResourcePool;
  now: Date;
}

export interface GraphNode {
  key: string;
  id: string;
  type: "SPINE" | "GROUP" | "TOPIC";
  parentKey: string | null;
  title: string;
  description: string;
  stage: Stage;
  side: "LEFT" | "RIGHT" | "CENTER";
  importance: Importance;
  skill: { id: string; name: string } | null;
  target: number | null;
  /** null = not assessed */
  level: number | null;
  confidence: number | null;
  verified: boolean;
  status: NodeStatus;
  userState: UserNodeState;
  skipReason: string | null;
  /** group/spine: weighted progress and how much of it rests on evidence */
  progress: number | null;
  evidenceCoverage: number | null;
  topics: number;
  assessedTopics: number;
  needsCheck: string | null;
  locked: boolean;
  coverage: { state: NodeCoverage["state"]; basis: NodeCoverage["basis"]; headline: string | null; courses: number } | null;
  /** counts of what can be done about it */
  practice: { arena: number; projects: number; certifications: number; learning: number };
  prerequisites: string[];
  unlocks: string[];
  /** a project or certification placed on the map (the "Build and prove it" stage) */
  resource: Resource | null;
  box: Box;
}

export interface GraphEdge {
  id: string;
  from: string;
  to: string;
  kind: "SPINE_NEXT" | "SPINE_GROUP" | "GROUP_TOPIC";
}

export type GraphUnavailable =
  | { state: "NO_CAREER" }
  | { state: "EXPLORING" }
  | { state: "NO_PLAN_B"; primary: string }
  | { state: "NO_TEMPLATE"; career: { id: string; key: string; name: string } }
  | { state: "NO_MEMBERSHIP" };

export interface RoadmapGraph {
  state: "READY";
  career: { id: string; key: string; name: string };
  template: { id: string; version: number; title: string; publishedAt: string | null };
  header: {
    /** share of the career's targets reached, importance-weighted; unassessed topics count as 0 here, which is why evidenceCoverage is shown beside it */
    readiness: number;
    evidenceCoverage: number;
    assessedTopics: number;
    totalTopics: number;
    position: Position;
    curriculum: { state: CurriculumContext["state"]; versionNo: number | null; regulation: string | null; branch: string | null; analysed: boolean | null };
  };
  nodes: GraphNode[];
  edges: GraphEdge[];
  bounds: Box;
  subjects: SubjectPriority[];
  /** every subject of the student's syllabus in teaching order, with how far evidence has proven the career topics it teaches; null without a published syllabus */
  syllabus: SubjectNode[] | null;
  /** at least one topic has a coverage state of UNKNOWN or the curriculum is missing: the panel explains */
  overlay: { inferredShown: boolean; inferredThreshold: number };
  tiers: Tier[];
}
