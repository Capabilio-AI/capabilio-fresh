"use client";

import { useEffect, useRef, useState } from "react";

/** Eases a displayed number toward `target`. Respects reduced motion by jumping straight there. */
export function useCountUp(target: number, durationMs = 700): number {
  const [shown, setShown] = useState(target);
  const from = useRef(target);
  useEffect(() => {
    const reduce = typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    if (reduce || from.current === target) {
      from.current = target;
      const t = setTimeout(() => setShown(target), 0);
      return () => clearTimeout(t);
    }
    const start = performance.now();
    const a = from.current;
    let raf = 0;
    const tick = (now: number) => {
      const p = Math.min(1, (now - start) / durationMs);
      const eased = 1 - Math.pow(1 - p, 3);
      setShown(Math.round(a + (target - a) * eased));
      if (p < 1) raf = requestAnimationFrame(tick);
      else from.current = target;
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [target, durationMs]);
  return shown;
}
