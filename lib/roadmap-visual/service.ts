import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { CareerChoice } from "@/lib/arena-challenges/career-state";
import { buildGraph } from "./graph-build";
import { loadGraphContext } from "./context";
import type { GraphUnavailable, RoadmapGraph } from "./graph-types";

type Service = SupabaseClient<Database>;

export type GraphResponse = ({ ok: true; graph: RoadmapGraph; which: CareerChoice; primary: string; planB: string | null } | { ok: false; reason: GraphUnavailable }) & { generatedAt: string };

export async function getRoadmapGraph(service: Service, userId: string, which: CareerChoice, now: Date = new Date()): Promise<GraphResponse> {
  const loaded = await loadGraphContext(service, userId, which, now);
  if (!loaded.ok) return { ok: false, reason: loaded.reason, generatedAt: now.toISOString() };
  return { ok: true, graph: buildGraph(loaded.ctx), which: loaded.meta.which, primary: loaded.meta.primary, planB: loaded.meta.planB, generatedAt: now.toISOString() };
}
