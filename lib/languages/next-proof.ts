import { moduleStatuses } from "./module-gate";
import type { ModuleProofRow } from "./module-gate";
import type { ProgressMap } from "./progress";
import type { Track } from "./types";

export interface NextProof { track: string; trackTitle: string; title: string; href: string; kind: "step" | "module" }

/** Pure. The one thing a student should prove next in a course: the first unfinished step of the first module that is open, or that module's test when its steps are done. */
export function nextProof(track: Track, progress: ProgressMap, proofs: Readonly<Record<string, ModuleProofRow>>): NextProof | null {
  const statuses = moduleStatuses(track, proofs);
  for (let i = 0; i < track.modules.length; i++) {
    const m = track.modules[i];
    if (statuses[i] === "locked") return null;
    if (statuses[i] === "proven") continue;
    const step = m.lessons.find((l) => !progress[l.key]);
    if (step) return { track: track.key, trackTitle: track.title, title: step.title, href: `/arena/prove/${track.key}/${step.key}`, kind: "step" };
    return { track: track.key, trackTitle: track.title, title: `${m.title}: module test`, href: `/skillstudio/courses/${track.key}/module/${m.key}`, kind: "module" };
  }
  return null;
}
