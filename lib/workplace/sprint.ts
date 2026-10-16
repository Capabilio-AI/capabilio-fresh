import type { Difficulty } from "@/lib/arena-workstations/types";
import { hashSeed } from "./rng";

/** A sprint is one work week at the company: five tickets that share a story. */
export const SPRINT_SLOTS = 5;

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** ISO date of the Monday of the week in India time, so a Sunday evening in UTC already belongs to next week's sprint. */
export function sprintWeekStart(date: Date): string {
  const ist = new Date(date.getTime() + IST_OFFSET_MS);
  const day = ist.getUTCDay(); // 0=Sun..6=Sat
  const back = day === 0 ? 6 : day - 1;
  return new Date(Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() - back)).toISOString().slice(0, 10);
}

export interface Story {
  title: string;
  blurb: string;
}

/** The story of a user's week: stable for them within the week, different from week to week. */
export function pickStory(stories: readonly Story[], userId: string, weekStart: string): Story {
  return stories[hashSeed(userId, weekStart, "story") % stories.length];
}

export interface BoardAssignment {
  id: string;
  title: string;
  areaName: string;
  difficulty: Difficulty;
  /** the kind of database work, when the ticket has one */
  kind: string | null;
  completedAt: string | null;
  /** when the next ticket may start (set once this one is finished) */
  nextAvailableAt: string | null;
}

export type SlotState = "done" | "active" | "next" | "cooling" | "locked";

export interface BoardSlot {
  index: number;
  state: SlotState;
  title?: string;
  areaName?: string;
  difficulty?: Difficulty;
  kind?: string | null;
  /** for a cooling slot: when it opens */
  availableAt?: string;
}

export interface Board {
  slots: BoardSlot[];
  completed: number;
  /** tickets finished beyond the five slots */
  bonus: number;
}

/** Pure. Lays the week's tickets (oldest first) onto the five slots. */
export function buildBoard({ assignments, now }: { assignments: readonly BoardAssignment[]; now: Date }): Board {
  const slots: BoardSlot[] = Array.from({ length: SPRINT_SLOTS }, (_, index) => {
    const a = assignments[index];
    if (a) return { index, state: a.completedAt ? "done" : "active", title: a.title, areaName: a.areaName, difficulty: a.difficulty, kind: a.kind };
    const last = assignments[index - 1];
    // one ticket at a time: the next slot opens only when the previous one is finished
    if (index === assignments.length && (!last || last.completedAt)) {
      const opensAt = last?.nextAvailableAt;
      return opensAt && Date.parse(opensAt) > now.getTime() ? { index, state: "cooling", availableAt: opensAt } : { index, state: "next" };
    }
    return { index, state: "locked" };
  });
  return { slots, completed: assignments.filter((a) => a.completedAt).length, bonus: Math.max(0, assignments.length - SPRINT_SLOTS) };
}
