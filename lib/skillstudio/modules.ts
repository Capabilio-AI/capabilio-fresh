// SkillStudio's learning modules: the student's own career roadmap, one card per module (a roadmap group), with its topics and what can
// be done about each. Read live from the same graph as the Roadmap tab, so progress here is the progress there.
import type { SupabaseClient } from "@supabase/supabase-js";
import { getRoadmapGraph } from "@/lib/roadmap-visual/service";
import type { GraphNode, RoadmapGraph, Stage } from "@/lib/roadmap-visual/graph-types";

export interface ModuleTopic {
  key: string;
  title: string;
  description: string;
  /** the student's own mark (Learning or Skipped); a topic is only Proven by evidence */
  userState: GraphNode["userState"];
  level: number | null;
  target: number | null;
  status: GraphNode["status"];
  learning: number;
  /** something can prove this topic (Arena challenges, projects or certifications are linked to it); a topic nothing can prove yet never blocks the next module */
  provable: boolean;
  /** verified proofs behind this topic; the course gate asks for PATH_PROOFS of them */
  proofs: number;
}
export interface LearningModule {
  key: string;
  /** where the path lists this module; the walking order is stage, then this */
  position: number;
  title: string;
  description: string;
  stage: Stage;
  focus: boolean;
  /** 0-100 weighted progress, null until something is measured */
  progress: number | null;
  topics: ModuleTopic[];
  assessed: number;
  practice: { arena: number; projects: number; certifications: number; learning: number };
}
export interface ModulesView {
  careerName: string;
  year: number | null;
  modules: LearningModule[];
}

const FOCUS: Record<number, Stage[]> = { 1: ["FOUNDATION"], 2: ["FOUNDATION", "CORE"], 3: ["CORE", "SPECIALIZATION"], 4: ["SPECIALIZATION", "JOB_READY"] };
const STAGE_ORDER: Stage[] = ["FOUNDATION", "CORE", "SPECIALIZATION", "JOB_READY"];

export async function loadModules(service: SupabaseClient, userId: string): Promise<ModulesView | null> {
  const res = await getRoadmapGraph(service as never, userId, "primary").catch(() => null);
  return res?.ok ? modulesFromGraph(res.graph) : null;
}

/** The modules of a built roadmap graph. Pure, so the course and lesson pages read the same shape from the one graph they already load. */
export function modulesFromGraph(graph: RoadmapGraph): ModulesView {
  const year = graph.header.position.year;
  const focusStages = new Set(FOCUS[Math.min(4, Math.max(1, year ?? 1))]);
  const topicsOf = new Map<string, GraphNode[]>();
  for (const n of graph.nodes) if (n.type === "TOPIC" && !n.resource && n.parentKey) topicsOf.set(n.parentKey, [...(topicsOf.get(n.parentKey) ?? []), n]);

  const modules = graph.nodes.filter((n) => n.type === "GROUP" && (topicsOf.get(n.key)?.length ?? 0) > 0).map((g, position): LearningModule => {
    const topics = topicsOf.get(g.key)!;
    return {
      key: g.key, position, title: g.title, description: g.description, stage: g.stage, focus: year === null || focusStages.has(g.stage),
      progress: g.progress, assessed: topics.filter((t) => t.level !== null).length,
      topics: topics.map((t) => ({ key: t.key, title: t.title, description: t.description, userState: t.userState, level: t.level, target: t.target, status: t.status, learning: t.practice.learning, provable: t.practice.arena + t.practice.projects + t.practice.certifications > 0, proofs: t.proofs })),
      practice: topics.reduce((a, t) => ({ arena: a.arena + t.practice.arena, projects: a.projects + t.practice.projects, certifications: a.certifications + t.practice.certifications, learning: a.learning + t.practice.learning }), { arena: 0, projects: 0, certifications: 0, learning: 0 }),
    };
  });
  // what to learn now first, then by stage, then the module furthest from done
  modules.sort((a, b) => Number(b.focus) - Number(a.focus) || STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || (a.progress ?? -1) - (b.progress ?? -1));
  return { careerName: graph.career.name, year, modules };
}
