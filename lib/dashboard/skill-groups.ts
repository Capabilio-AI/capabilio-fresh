// Groups the student's skills by area for the gap analysis. Source of truth is the career roadmap tree (every area, with its stage);
// a role without a published roadmap falls back to the assessed skills grouped by category. Both read live data on every request.
import type { SupabaseClient } from "@supabase/supabase-js";
import type { CareerProfile } from "@/lib/assess/career-profile";
import { getRoadmapGraph } from "@/lib/roadmap-visual/service";
import type { Stage } from "@/lib/roadmap-visual/graph-types";

export interface GapSkill {
  skill: string;
  area: string;
  stage: Stage | null;
  /** 0-100, null until something measures it */
  score: number | null;
  /** the level the role asks for */
  required: number;
  /** true when this stage is what the student should be working on at their year */
  focus: boolean;
}

const FOCUS: Record<number, Stage[]> = { 1: ["FOUNDATION"], 2: ["FOUNDATION", "CORE"], 3: ["CORE", "SPECIALIZATION"], 4: ["SPECIALIZATION", "JOB_READY"] };
const FALLBACK_AREA = "Core skills";

export async function loadGapSkills(service: SupabaseClient, userId: string, profile: CareerProfile): Promise<GapSkill[]> {
  const graph = await getRoadmapGraph(service as never, userId, "primary").catch(() => null);
  if (graph?.ok) {
    const year = graph.graph.header.position.year;
    const focus = new Set(FOCUS[Math.min(4, Math.max(1, year ?? 1))]);
    const groups = new Map(graph.graph.nodes.filter((n) => n.type === "GROUP").map((n) => [n.key, n]));
    const fromGraph = graph.graph.nodes.flatMap((n): GapSkill[] => {
      const g = n.type === "TOPIC" && !n.resource && n.parentKey ? groups.get(n.parentKey) : null;
      return g && n.target !== null ? [{ skill: n.title, area: g.title, stage: g.stage, score: n.level, required: n.target, focus: year === null || focus.has(g.stage) }] : [];
    });
    if (fromGraph.length > 0) return fromGraph;
  }
  return profile.skills.map((k) => ({ skill: k.name, area: k.category ?? FALLBACK_AREA, stage: null, score: k.score, required: k.targetLevel, focus: true }));
}
