export const COOLDOWN_MS = 24 * 60 * 60 * 1000;

export interface AssignmentRow {
  id: string;
  challenge_id: string;
  assigned_at: string;
  completed_at: string | null;
  next_available_at: string | null;
}

export type DailyState =
  | { kind: "active"; assignment: AssignmentRow }
  | { kind: "cooldown"; nextAvailableAt: string }
  | { kind: "assign_next" };

/**
 * Pure. One ticket at a time: an unfinished ticket stays open indefinitely;
 * once finished, the next one unlocks 24h after completion.
 */
export function resolveDailyState(assignments: AssignmentRow[], now: Date): DailyState {
  const open = assignments.find((a) => a.completed_at === null);
  if (open) return { kind: "active", assignment: open };

  const latest = assignments
    .filter((a) => a.next_available_at)
    .sort((a, b) => Date.parse(b.next_available_at!) - Date.parse(a.next_available_at!))[0];
  if (latest && Date.parse(latest.next_available_at!) > now.getTime()) {
    return { kind: "cooldown", nextAvailableAt: latest.next_available_at! };
  }
  return { kind: "assign_next" };
}

/** Pure. The lowest-sequence ticket the student hasn't been assigned yet; null when they've done them all. */
export function pickNextTicket<T extends { id: string; sequence: number | null }>(tickets: T[], assignedIds: Set<string>): T | null {
  return [...tickets].filter((t) => !assignedIds.has(t.id)).sort((a, b) => (a.sequence ?? 0) - (b.sequence ?? 0))[0] ?? null;
}
