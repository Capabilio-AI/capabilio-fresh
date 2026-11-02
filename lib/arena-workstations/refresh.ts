/**
 * Everything on the Arena and dashboard that shows a rating, a streak or a history reads it from the server once, when it appears. When a ticket closes
 * (solved, wrong, or out of time) the workspace calls this so each of them reads again straight away instead of waiting for a page reload.
 */
export const ARENA_CHANGED = "capabilio:arena-changed";

export function announceArenaChange(): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(ARENA_CHANGED));
}
