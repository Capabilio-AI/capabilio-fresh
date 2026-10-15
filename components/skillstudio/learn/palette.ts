import type { Stage } from "@/lib/roadmap-visual/graph-types";

// Course colours. Every one holds white text at 4.5:1 or better, so a cover never needs a darker overlay to stay readable.
const COLORS = ["#b3265b", "#0b5cad", "#0d7a45", "#9a4a08", "#7a3e9d", "#00717a", "#c01b27", "#7a4f26"] as const;

/** A course keeps its colour whatever the filter or order, because it is derived from the course itself. */
export function courseColor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return COLORS[h % COLORS.length];
}

export const STAGE_ORDER: Stage[] = ["FOUNDATION", "CORE", "SPECIALIZATION", "JOB_READY"];
export const STAGE_NAME: Record<Stage, string> = { FOUNDATION: "Foundation", CORE: "Core", SPECIALIZATION: "Specialisation", JOB_READY: "Job-ready" };
