"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import type { DiagnosticSnapshot } from "@/lib/roadmap-visual/diagnostic-store";

/** Offers the baseline check while it is useful (not started, in progress, or skipped) and says nothing otherwise. */
export function CheckBanner({ career, assessedTopics }: { career: "primary" | "plan-b"; assessedTopics: number }) {
  const [snap, setSnap] = useState<DiagnosticSnapshot | null>(null);
  useEffect(() => {
    let live = true;
    fetch(`/api/roadmap/diagnostic?career=${career}`, { cache: "no-store" })
      .then((r) => (r.ok ? (r.json() as Promise<DiagnosticSnapshot>) : null))
      .then((d) => live && setSnap(d))
      .catch(() => live && setSnap(null));
    return () => {
      live = false;
    };
  }, [career, assessedTopics]);
  if (!snap || !["NOT_STARTED", "IN_PROGRESS", "SKIPPED"].includes(snap.state)) return null;
  const copy = snap.state === "IN_PROGRESS" ? ["You have a baseline check in progress.", "Resume"] : snap.state === "SKIPPED" ? ["You skipped the baseline check, so many topics show “not assessed”.", "Take it now"] : ["Most topics are “not assessed” yet. A 10-minute check places you on the map.", "Take the baseline check"];
  return (
    <div role="region" aria-label="Baseline check" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-orange bg-app-orange-container px-4 py-3">
      <p className="font-lp-body text-[13px] text-app-charcoal">{copy[0]}</p>
      <Link href={`/dashboard/roadmap/check${career === "plan-b" ? "?career=plan-b" : ""}`} className="rounded-md bg-app-charcoal px-3 py-1.5 font-lp-body text-[12.5px] text-white">{copy[1]}</Link>
    </div>
  );
}
