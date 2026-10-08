"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Milestone, Sparkles } from "lucide-react";
import type { GuidePathRecord } from "@/lib/guide-path/read";

export function GuidePathPanel({ careerRole, initial }: { careerRole: string; initial: GuidePathRecord | null }) {
  const router = useRouter();
  const [path, setPath] = useState<GuidePathRecord | null>(initial);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function generate() {
    setLoading(true);
    setError(null);
    const res = await fetch("/api/guide-path/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ targetCareer: careerRole, isPrimary: true }),
    });
    setLoading(false);
    if (!res.ok) {
      setError("Could not generate a path right now — try again in a moment.");
      return;
    }
    router.refresh();
  }

  if (!path) {
    return (
      <div className="rounded-xl border border-dashed border-[var(--m-rule)] bg-white p-8 text-center">
        <Sparkles size={20} className="mx-auto text-app-orange" />
        <p className="mt-3 font-lp-body text-[13.5px] text-app-muted">
          Generate a phased learning plan for {careerRole}, sequenced against your actual skill gaps.
        </p>
        {error && <p className="mt-2 font-lp-body text-[12.5px] text-app-warning">{error}</p>}
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="mt-4 inline-flex items-center gap-2 rounded-lg bg-app-charcoal px-4 py-2.5 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60"
        >
          {loading && <Loader2 size={14} className="animate-spin" />}
          Generate personalized path
        </button>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-[var(--m-rule)] bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[12.5px] font-bold text-app-orange">
          <Milestone size={14} />
          Guide path · v{path.version}
        </div>
        <button
          type="button"
          onClick={generate}
          disabled={loading}
          className="font-lp-mono text-[11px] text-app-blue hover:underline disabled:opacity-60"
        >
          {loading ? "Regenerating…" : "Regenerate"}
        </button>
      </div>
      <div className="mt-4 flex flex-col gap-4">
        {path.phases.map((phase, i) => (
          <div key={phase.skill} className="flex gap-4 border-l-2 border-[var(--m-rule)] pl-4">
            <div className="flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-[12.5px] font-bold text-app-muted">
                  {phase.phaseLabel}
                </span>
                <span className="font-lp-body text-[13.5px] font-semibold text-[var(--m-ink)]">{phase.skill}</span>
                <span className="font-lp-mono text-[11px] text-app-muted">
                  {phase.currentScore ?? 0} → {phase.targetScore}
                </span>
              </div>
              <p className="mt-1.5 font-lp-body text-[13px] leading-relaxed text-app-muted">{phase.why}</p>
              {phase.projects.length > 0 && (
                <p className="mt-1.5 font-lp-body text-[12.5px] text-[var(--m-ink)]">
                  <span className="text-app-muted">Projects: </span>
                  {phase.projects.join(", ")}
                </p>
              )}
              {phase.milestones.length > 0 && (
                <p className="mt-1 font-lp-body text-[12.5px] text-[var(--m-ink)]">
                  <span className="text-app-muted">Milestones: </span>
                  {phase.milestones.join(", ")}
                </p>
              )}
            </div>
            <span className="mt-0.5 shrink-0 font-lp-mono text-[11px] text-app-border">{i + 1}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
