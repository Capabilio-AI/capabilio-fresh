import type { SupabaseClient } from "@supabase/supabase-js";
import { buildGraph } from "@/lib/roadmap-visual/graph-build";
import { loadGraphContext } from "@/lib/roadmap-visual/context";
import { explainNode, type NodeExplanation } from "@/lib/roadmap-visual/explain-node";
import type { GraphUnavailable } from "@/lib/roadmap-visual/graph-types";
import { findTopic } from "./catalog";
import { modulesFromGraph, type LearningModule, type ModulesView, type ModuleTopic } from "./modules";

export type LearningLoad =
  | { ok: true; careerId: string; view: ModulesView; explain: (topicKey: string) => NodeExplanation | null }
  | { ok: false; reason: GraphUnavailable | { state: "ERROR" } };

/**
 * The student's whole learning path from one read of their roadmap data: the modules, and a way to explain any topic in them. The same
 * facts the Roadmap shows, so SkillStudio can never disagree with it. Says why when there is nothing to show instead of inventing a path.
 */
export async function loadLearning(service: SupabaseClient, userId: string): Promise<LearningLoad> {
  try {
    const loaded = await loadGraphContext(service as never, userId, "primary");
    if (!loaded.ok) return { ok: false, reason: loaded.reason };
    const view = modulesFromGraph(buildGraph(loaded.ctx));
    return { ok: true, careerId: loaded.ctx.career.id, view, explain: (key) => explainNode(loaded.ctx, key) };
  } catch (e) {
    console.error("[skillstudio] could not load the learning path:", e);
    return { ok: false, reason: { state: "ERROR" } };
  }
}

export interface LessonData {
  careerId: string;
  careerName: string;
  module: LearningModule;
  topic: ModuleTopic;
  explanation: NodeExplanation;
  /** which course each topic belongs to, so a prerequisite in another module still links to its lesson */
  courseOf: Record<string, string>;
}

export function lessonFrom(load: Extract<LearningLoad, { ok: true }>, moduleKey: string, topicKey: string): LessonData | null {
  const hit = findTopic(load.view, topicKey);
  const explanation = load.explain(topicKey);
  if (!hit || hit.module.key !== moduleKey || !explanation || explanation.type !== "TOPIC") return null;
  const courseOf = Object.fromEntries(load.view.modules.flatMap((m) => m.topics.map((t) => [t.key, m.key] as const)));
  return { careerId: load.careerId, careerName: load.view.careerName, module: hit.module, topic: hit.topic, explanation, courseOf };
}
