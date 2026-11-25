import type { Stage } from "@/lib/roadmap-visual/graph-types";
import type { LearningModule, ModuleTopic } from "./modules";

/**
 * The path is walked one module at a time. A module is PROVEN when every topic that can be proven (it has Arena challenges, projects or certifications behind it) has reached
 * its target on evidence; the next module opens only then. A topic nothing can prove yet never blocks anyone, and neither does a topic the student skipped count as proof:
 * only evidence opens the next module. Pure, so the page and the server pages apply one rule.
 */
const STAGE_ORDER: Stage[] = ["FOUNDATION", "CORE", "SPECIALIZATION", "JOB_READY"];

export type ModuleGate = "proven" | "open" | "locked";
export interface GateInfo { gate: ModuleGate; /** the module that must be proven first, when locked */ blockedBy: string | null; /** topics still to prove in this module */ remaining: number }

/** The fixed order modules are walked in: by stage, then the order the path lists them. Never by progress, so a module cannot jump the queue. */
export const walkOrder = (modules: readonly LearningModule[]): LearningModule[] =>
  [...modules].sort((a, b) => STAGE_ORDER.indexOf(a.stage) - STAGE_ORDER.indexOf(b.stage) || a.position - b.position);

const toProve = (m: LearningModule): ModuleTopic[] => m.topics.filter((t) => t.provable && t.status !== "TARGET_MET");

export function gateModules(modules: readonly LearningModule[]): Map<string, GateInfo> {
  const out = new Map<string, GateInfo>();
  let blocker: LearningModule | null = null;
  for (const m of walkOrder(modules)) {
    const remaining = toProve(m).length;
    if (blocker) { out.set(m.key, { gate: "locked", blockedBy: blocker.title, remaining }); continue; }
    if (remaining === 0) { out.set(m.key, { gate: "proven", blockedBy: null, remaining: 0 }); continue; }
    out.set(m.key, { gate: "open", blockedBy: null, remaining });
    blocker = m;
  }
  return out;
}

/** Whether every module is proven: the path is done and the role's Arena proof sessions are the next thing. */
export const pathProven = (modules: readonly LearningModule[]): boolean => modules.length > 0 && [...gateModules(modules).values()].every((g) => g.gate === "proven");
