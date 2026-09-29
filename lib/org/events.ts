import type { OrgPostRow } from "./db";

/** Pure (given `now`). Upcoming events soonest-first, past events most-recent-first. */
export function splitEvents<T extends Pick<OrgPostRow, "type" | "event_starts_at">>(posts: T[], now: Date = new Date()): { upcoming: T[]; past: T[] } {
  const at = (p: T) => new Date(p.event_starts_at ?? 0).getTime();
  const events = posts.filter((p) => p.type === "event").sort((a, b) => at(a) - at(b));
  return { upcoming: events.filter((p) => at(p) >= now.getTime()), past: events.filter((p) => at(p) < now.getTime()).reverse() };
}
