import { ARENA_LEVEL_PER_VERIFIED } from "@/lib/capability/read-model";
import { TIME_LIMIT_MINUTES } from "@/lib/arena-challenges/timer";
import type { PractiseArea } from "@/lib/arena/skill-context";
import { JOB_READY_LEVEL, type JobMatch, type SkillMatch } from "./match";

/** What one ticket usually takes: the middle difficulty's time limit. */
export const TYPICAL_TICKET_MINUTES = TIME_LIMIT_MINUTES.medium;

export type PrepAction =
  | { kind: "arena"; areaKey: string; areaName: string; href: string }
  | { kind: "studio"; href: string };

export interface PrepStep {
  skillId: string;
  skill: string;
  level: number | null;
  state: "building" | "unmeasured";
  /** the level the job needs */
  target: number;
  /** Arena tickets expected to close the gap; 0 when the step is to learn in SkillStudio */
  ticketsNeeded: number;
  action: PrepAction;
}

export interface Preparation {
  steps: PrepStep[];
  /** skills the job lists that the user already meets */
  ready: SkillMatch[];
  /** job skills that are not in the skill catalog, so they are not part of the plan */
  unmapped: string[];
  totalTickets: number;
  totalMinutes: number;
  /** days at one ticket a day (the Arena limit) */
  days: number;
}

/**
 * Pure. A preparation plan for one job: for each skill the user does not yet meet, what to do and about how long it takes. The estimate is
 * rough on purpose: a verified Arena ticket adds about 25 levels, so a skill needs about (job-ready level − current level) ÷ 25 tickets.
 */
export function buildPreparation(match: JobMatch, practise: ReadonlyMap<string, PractiseArea>): Preparation {
  const steps = match.gaps.flatMap((g): PrepStep[] => {
    if (!g.skillId || g.state === "met" || g.state === "unmapped") return [];
    const area = practise.get(g.skillId);
    const base = { skillId: g.skillId, skill: g.text, level: g.level, state: g.state, target: JOB_READY_LEVEL };
    if (!area) return [{ ...base, ticketsNeeded: 0, action: { kind: "studio", href: "/skillstudio" } }];
    const ticketsNeeded = Math.max(1, Math.ceil((JOB_READY_LEVEL - (g.level ?? 0)) / ARENA_LEVEL_PER_VERIFIED));
    return [{ ...base, ticketsNeeded, action: { kind: "arena", areaKey: area.areaKey, areaName: area.areaName, href: `/arena/challenges/domain?focus=${area.areaKey}` } }];
  });
  const totalTickets = steps.reduce((sum, s) => sum + s.ticketsNeeded, 0);
  return {
    steps,
    ready: match.skills.filter((s) => s.state === "met"),
    unmapped: match.skills.filter((s) => s.state === "unmapped").map((s) => s.text),
    totalTickets,
    totalMinutes: totalTickets * TYPICAL_TICKET_MINUTES,
    days: totalTickets,
  };
}
