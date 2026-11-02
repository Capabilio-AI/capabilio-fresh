"use client";

import { useState, useTransition } from "react";
import { Eye, EyeOff } from "lucide-react";
import { setEvidenceShared } from "@/app/(app)/dashboard/portfolio/actions";

/** Owner-only. Decides whether recruiters opening the shared portfolio can see this task and its evidence. The sealed record itself never changes. */
export function EvidenceShareToggle({ attemptId, initialShared }: { attemptId: string; initialShared: boolean }) {
  const [shared, setShared] = useState(initialShared);
  const [error, setError] = useState<string | null>(null);
  const [pending, start] = useTransition();

  function flip() {
    const next = !shared;
    setError(null);
    setShared(next);
    start(async () => {
      const r = await setEvidenceShared(attemptId, next);
      if ("error" in r) {
        setShared(!next);
        setError(r.error);
      }
    });
  }

  return (
    <span className="inline-flex flex-col items-end print:hidden">
      <button type="button" onClick={flip} disabled={pending} aria-pressed={shared} title={shared ? "Recruiters can open this task. Click to hide it from your shared portfolio." : "Hidden from your shared portfolio. Click to show it."} className="inline-flex items-center gap-1.5 rounded-md px-2 py-1 font-lp-body text-[12.5px] font-bold text-[var(--m-muted)] hover:bg-[var(--m-ground)] disabled:opacity-60">
        {shared ? <Eye size={14} aria-hidden /> : <EyeOff size={14} aria-hidden />}
        {shared ? "Shown to recruiters" : "Hidden"}
      </button>
      {error && <span role="alert" className="font-lp-body text-[11.5px] text-app-rose">{error}</span>}
    </span>
  );
}
