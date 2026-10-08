import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getRoadmapGraph } from "./service";
import type { Resource } from "./graph-types";

export interface CareerResources {
  which: "primary" | "plan-b";
  careerName: string;
  projects: Resource[];
  certifications: Resource[];
}

/** The projects and certifications on the roadmaps of the careers the student chose (primary, then Plan B). Empty for a career without a published roadmap. */
export async function loadCareerResources(service: SupabaseClient<Database>, userId: string): Promise<CareerResources[]> {
  const out: CareerResources[] = [];
  const seen = new Set<string>();
  for (const which of ["primary", "plan-b"] as const) {
    const res = await getRoadmapGraph(service, userId, which).catch(() => null);
    if (!res?.ok) continue;
    const mine = res.graph.nodes.flatMap((n) => (n.resource && !seen.has(n.resource.id) ? [n.resource] : []));
    mine.forEach((r) => seen.add(r.id));
    out.push({ which, careerName: res.graph.career.name, projects: mine.filter((r) => r.kind === "PROJECT"), certifications: mine.filter((r) => r.kind === "CERTIFICATION") });
  }
  return out;
}
