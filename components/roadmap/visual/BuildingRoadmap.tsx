"use client";

import { useEffect, useRef, useState } from "react";

const POLL_MS = 5_000;
const GIVE_UP_MS = 9 * 60_000;
const FALLBACK = "We couldn't build this roadmap yet. Try again in a few minutes.";

/**
 * A career with no roadmap yet: ask the server to build it, then wait for it. Nothing here is faked: the status comes from the generation run,
 * and the page continues by itself as soon as the roadmap is published.
 */
export function BuildingRoadmap({ career, careerName, onReady }: { career: "primary" | "plan-b"; careerName: string; onReady: () => void }) {
  const [failure, setFailure] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);
  // the parent passes a new function each render; a ref keeps the effect from restarting the build when it does
  const ready = useRef(onReady);
  useEffect(() => {
    ready.current = onReady;
  });

  useEffect(() => {
    const url = `/api/roadmap/generate?career=${career}`;
    const startedAt = Date.now();
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    async function step(first: boolean) {
      try {
        const res = await fetch(url, first ? { method: "POST" } : { cache: "no-store" });
        const data = (await res.json()) as { state?: string; message?: string | null; error?: string };
        if (cancelled) return;
        if (data.state === "READY") return ready.current();
        if (data.state === "FAILED" || (!res.ok && res.status !== 202)) return setFailure(data.message ?? data.error ?? FALLBACK);
        if (!first && data.state === "IDLE") return setFailure(FALLBACK);
      } catch {
        if (cancelled) return;
        if (first) return setFailure("Couldn't reach the server. Check your connection and try again.");
        // a dropped poll just means we ask again
      }
      if (Date.now() - startedAt > GIVE_UP_MS) return setFailure("This is taking longer than expected. Try again in a few minutes.");
      timer = setTimeout(() => void step(false), POLL_MS);
    }
    void step(true);
    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [career, attempt]);

  if (failure) {
    return (
      <div role="alert" className="rounded-xl border border-dashed border-app-border bg-white px-6 py-10 text-center">
        <h2 className="font-lp-display text-[18px] font-semibold text-app-charcoal">The {careerName} roadmap isn&apos;t ready</h2>
        <p className="mx-auto mt-1.5 max-w-[56ch] font-lp-body text-[13.5px] text-app-muted">{failure}</p>
        <button type="button" onClick={() => { setFailure(null); setAttempt((n) => n + 1); }} className="mt-4 rounded-md bg-app-charcoal px-4 py-2 font-lp-body text-[13px] text-white">Try again</button>
      </div>
    );
  }
  return (
    <div role="status" aria-live="polite" className="rounded-xl border border-app-border bg-white px-6 py-10 text-center">
      <svg aria-hidden width="120" height="24" viewBox="0 0 120 24" className="mx-auto mb-4"><path d="M12 12h96" stroke="#cfd7e3" strokeWidth="6" strokeLinecap="round" /><path className="metro-pulse" d="M12 12h96" stroke="#0b1b33" strokeWidth="6" strokeLinecap="round" /><circle cx="12" cy="12" r="6" fill="#fff" stroke="#0b1b33" strokeWidth="3" /><circle cx="60" cy="12" r="6" fill="#fff" stroke="#0b1b33" strokeWidth="3" strokeDasharray="3.4 2.6" /><circle cx="108" cy="12" r="6" fill="#fff" stroke="#0b1b33" strokeWidth="3" strokeDasharray="3.4 2.6" /></svg>
      <h2 className="font-lp-display text-[18px] font-semibold text-app-charcoal">Building your {careerName} roadmap</h2>
      <p className="mx-auto mt-1.5 max-w-[56ch] font-lp-body text-[13.5px] text-app-muted">
        We are designing the topics, checking each one against our skill list, and finding projects and certifications for it. The first time takes a few minutes. You can leave this page and come back; it keeps building.
      </p>
    </div>
  );
}
