"use client";

import { useEffect, useRef } from "react";
import { ARENA_CHANGED } from "@/lib/arena-workstations/refresh";

/** Runs `load` again whenever the numbers behind this screen may have moved: a ticket closed, the tab got focus back, or a minute passed while it is on screen. */
export function useLive(load: () => void, intervalMs = 30_000): void {
  const saved = useRef(load);
  useEffect(() => { saved.current = load; });
  useEffect(() => {
    const run = () => saved.current();
    const onVisible = () => { if (document.visibilityState === "visible") run(); };
    const timer = window.setInterval(onVisible, intervalMs);
    window.addEventListener(ARENA_CHANGED, run);
    window.addEventListener("focus", run);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      window.removeEventListener(ARENA_CHANGED, run);
      window.removeEventListener("focus", run);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [intervalMs]);
}
