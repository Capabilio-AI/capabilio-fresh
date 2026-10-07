"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { GraphResponse } from "@/lib/roadmap-visual/service";

export type CareerSlot = "primary" | "plan-b";
const POLL_MS = 60_000;

/**
 * The live roadmap: loads on mount, re-checks every minute while the tab is visible, whenever the tab regains focus, and after any local action
 * (`refresh()`). A failed refresh keeps the last good roadmap on screen and says so rather than blanking it.
 */
export function useRoadmapGraph(initial: GraphResponse, career: CareerSlot) {
  const [data, setData] = useState<GraphResponse>(initial);
  const [stale, setStale] = useState(false);
  const [loading, setLoading] = useState(false);
  const seq = useRef(0);
  const first = useRef(true);

  const refresh = useCallback(async () => {
    const mine = ++seq.current;
    setLoading(true);
    try {
      const res = await fetch(`/api/roadmap/graph?career=${career}`, { cache: "no-store" });
      if (!res.ok) throw new Error(String(res.status));
      const next = (await res.json()) as GraphResponse;
      if (mine === seq.current) {
        setData(next);
        setStale(false);
      }
    } catch {
      if (mine === seq.current) setStale(true);
    } finally {
      if (mine === seq.current) setLoading(false);
    }
  }, [career]);

  useEffect(() => {
    // the server already rendered the first career; fetch when the student switches
    if (first.current) {
      first.current = false;
      return;
    }
    void refresh();
  }, [refresh]);

  useEffect(() => {
    const tick = () => document.visibilityState === "visible" && void refresh();
    const timer = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", tick);
    window.addEventListener("focus", tick);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", tick);
      window.removeEventListener("focus", tick);
    };
  }, [refresh]);

  return { data, stale, loading, refresh };
}
