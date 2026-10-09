// Pulse is one live surface: a follow in the sidebar changes the feed, the counts and the suggestions at once. Components announce what
// changed with a window event and the ones that show the affected data re-read it, so no part of the page waits for a manual refresh.
export const GRAPH_CHANGED = "pulse:graph-changed";
export const POSTED = "pulse:posted";

export function announce(name: typeof GRAPH_CHANGED | typeof POSTED): void {
  if (typeof window !== "undefined") window.dispatchEvent(new Event(name));
}

/** Runs `fn` on every announcement of `name`; returns the unsubscribe. */
export function onAnnounce(name: typeof GRAPH_CHANGED | typeof POSTED, fn: () => void): () => void {
  window.addEventListener(name, fn);
  return () => window.removeEventListener(name, fn);
}
