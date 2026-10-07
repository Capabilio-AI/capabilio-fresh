"use client";

import { useState } from "react";
import type { RoadmapGraph } from "@/lib/roadmap-visual/graph-types";
import { send } from "@/components/roadmap/v2/api";

const timeAgo = (iso: string) => {
  const m = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 60000));
  return m < 1 ? "just now" : m < 60 ? `${m} min ago` : `${Math.round(m / 60)} h ago`;
};

export function RoadmapHeader({ graph, generatedAt, which, planB, onWhich, onRefresh, loading, stale, onChanged }: { graph: RoadmapGraph; generatedAt: string; which: "primary" | "plan-b"; planB: string | null; onWhich: (w: "primary" | "plan-b") => void; onRefresh: () => void; loading: boolean; stale: boolean; onChanged: () => void }) {
  const h = graph.header;
  const [error, setError] = useState<string | null>(null);
  const setSemester = async (semester: 1 | 2) => {
    setError(null);
    const r = await send("PUT", "/api/roadmap/semester", { semester });
    if (!r.ok) return setError(r.error ?? "Could not save.");
    onChanged();
  };
  const c = h.curriculum;
  return (
    <header className="space-y-3 rounded-xl border border-app-border bg-white p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="font-lp-mono text-[10.5px] uppercase text-app-muted">Career roadmap</p>
          <h2 className="font-lp-display text-[20px] font-semibold text-app-charcoal">{graph.career.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {planB && (
            <div role="group" aria-label="Career" className="flex overflow-hidden rounded-md border border-app-border">
              {(["primary", "plan-b"] as const).map((w) => (
                <button key={w} type="button" aria-pressed={which === w} onClick={() => onWhich(w)} className={`px-3 py-1.5 font-lp-body text-[12.5px] ${which === w ? "bg-app-charcoal text-white" : "bg-white text-app-charcoal"}`}>{w === "primary" ? "Primary" : "Plan B"}</button>
              ))}
            </div>
          )}
          <button type="button" onClick={onRefresh} disabled={loading} className="rounded-md border border-app-border px-3 py-1.5 font-lp-body text-[12.5px] hover:border-app-charcoal disabled:opacity-50">Refresh</button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><dt className="font-lp-mono text-[10px] uppercase text-app-muted">Readiness</dt><dd className="font-lp-display text-[22px] font-semibold text-app-charcoal">{h.readiness}%</dd><dd className="font-lp-body text-[11px] text-app-muted">of target levels, importance-weighted</dd></div>
        <div><dt className="font-lp-mono text-[10px] uppercase text-app-muted">Evidence coverage</dt><dd className="font-lp-display text-[22px] font-semibold text-app-charcoal">{h.evidenceCoverage}%</dd><dd className="font-lp-body text-[11px] text-app-muted">{h.assessedTopics} of {h.totalTopics} topics assessed</dd></div>
        <div>
          <dt className="font-lp-mono text-[10px] uppercase text-app-muted">Where you are</dt>
          <dd className="font-lp-body text-[13px] text-app-charcoal">{h.position.year ? `Year ${h.position.year}${h.position.totalYears ? ` of ${h.position.totalYears}` : ""}` : "Year not confirmed"}</dd>
          {h.position.year && (
            <dd className="font-lp-body text-[12px] text-app-muted">
              <label htmlFor="sem" className="sr-only">Current semester</label>
              Semester <select id="sem" value={h.position.semester ?? 1} onChange={(e) => void setSemester(Number(e.target.value) as 1 | 2)} className="rounded border border-app-border bg-white px-1 py-0.5">
                <option value={1}>1</option><option value={2}>2</option>
              </select>{h.position.semesterEstimated ? " (estimated: confirm yours)" : ""}
            </dd>
          )}
        </div>
        <div>
          <dt className="font-lp-mono text-[10px] uppercase text-app-muted">College syllabus</dt>
          <dd className="font-lp-body text-[13px] text-app-charcoal">{c.state === "PUBLISHED" ? `Published${c.regulation ? ` · ${c.regulation}` : ""}` : c.state === "REGULATION_MISMATCH" ? "None for your regulation" : c.state === "NO_BRANCH" ? "Branch not set" : "Not published yet"}</dd>
          {c.state === "PUBLISHED" && c.analysed === false && <dd className="font-lp-body text-[11px] text-app-warning">Still being analysed</dd>}
        </div>
      </dl>

      <p aria-live="polite" className="font-lp-body text-[11.5px] text-app-muted">
        {stale ? <span className="text-app-warning">Couldn’t refresh just now; showing what we last loaded. </span> : null}{loading ? "Refreshing… " : ""}Updated {timeAgo(generatedAt)}. Levels come only from your verified evidence; topics without evidence say “not assessed”.
      </p>
      {error && <p role="alert" className="font-lp-body text-[12px] text-app-rose">{error}</p>}
    </header>
  );
}
