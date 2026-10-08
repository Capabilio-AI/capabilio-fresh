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
    <header className="space-y-4 rounded-xl bg-[var(--m-ink)] p-5 text-white">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="flex items-center gap-3 font-lp-display text-[24px] font-bold leading-tight"><svg width="44" height="14" viewBox="0 0 44 14" aria-hidden><path d="M3 7h38" stroke="#fff" strokeWidth="4" strokeLinecap="round" /><circle cx="3" cy="7" r="3" className="fill-[var(--m-ink)]" stroke="#fff" strokeWidth="2.5" /><circle cx="22" cy="7" r="3" className="fill-[var(--m-ink)]" stroke="#fff" strokeWidth="2.5" /><circle cx="41" cy="7" r="3" className="fill-[var(--m-ink)]" stroke="#fff" strokeWidth="2.5" /></svg>{graph.career.name}</h2>
        </div>
        <div className="flex items-center gap-2">
          {planB && (
            <div role="group" aria-label="Career" className="flex overflow-hidden rounded-md border border-white/40">
              {(["primary", "plan-b"] as const).map((w) => (
                <button key={w} type="button" aria-pressed={which === w} onClick={() => onWhich(w)} className={`px-3 py-1.5 font-lp-body text-[12.5px] ${which === w ? "bg-white text-[var(--m-ink)] font-bold" : "text-white"}`}>{w === "primary" ? "Primary" : "Plan B"}</button>
              ))}
            </div>
          )}
          <button type="button" onClick={onRefresh} disabled={loading} className="rounded-md border border-white/40 px-3 py-1.5 font-lp-body text-[12.5px] hover:bg-white/10 disabled:opacity-50">Refresh</button>
        </div>
      </div>

      <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <div><dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--m-soft)]">Readiness</dt><dd className="font-lp-display text-[28px] font-bold leading-none">{h.readiness}%</dd><dd className="font-lp-body text-[11.5px] text-[var(--m-soft)]">of target levels, importance-weighted</dd></div>
        <div><dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--m-soft)]">Evidence coverage</dt><dd className="font-lp-display text-[28px] font-bold leading-none">{h.evidenceCoverage}%</dd><dd className="font-lp-body text-[11px] text-[var(--m-soft)]">{h.assessedTopics} of {h.totalTopics} topics assessed</dd></div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--m-soft)]">Where you are</dt>
          <dd className="font-lp-body text-[14px] font-bold">{h.position.year ? `Year ${h.position.year}${h.position.totalYears ? ` of ${h.position.totalYears}` : ""}` : "Year not confirmed"}</dd>
          {h.position.year && (
            <dd className="font-lp-body text-[12px] text-[var(--m-soft)]">
              <label htmlFor="sem" className="sr-only">Current semester</label>
              Semester <select id="sem" value={h.position.semester ?? 1} onChange={(e) => void setSemester(Number(e.target.value) as 1 | 2)} className="rounded border border-white/40 bg-white px-1 py-0.5 text-[var(--m-ink)]">
                <option value={1}>1</option><option value={2}>2</option>
              </select>{h.position.semesterEstimated ? " (estimated: confirm yours)" : ""}
            </dd>
          )}
        </div>
        <div>
          <dt className="text-[11px] font-bold uppercase tracking-wide text-[var(--m-soft)]">College syllabus</dt>
          <dd className="font-lp-body text-[14px] font-bold">{c.state === "PUBLISHED" ? `Published${c.regulation ? ` · ${c.regulation}` : ""}` : c.state === "REGULATION_MISMATCH" ? "None for your regulation" : c.state === "NO_BRANCH" ? "Branch not set" : "Not published yet"}</dd>
          {c.state === "PUBLISHED" && c.analysed === false && <dd className="font-lp-body text-[11.5px] text-[#ffd699]">Still being analysed</dd>}
        </div>
      </dl>

      <p aria-live="polite" className="font-lp-body text-[12px] text-[var(--m-soft)]">
        {stale ? <span className="text-[#ffd699]">Couldn’t refresh just now; showing what we last loaded. </span> : null}{loading ? "Refreshing… " : ""}Updated {timeAgo(generatedAt)}. Levels come only from your verified evidence; topics without evidence say “not assessed”.
      </p>
      {error && <p role="alert" className="font-lp-body text-[12px] text-[#ffb4a8]">{error}</p>}
    </header>
  );
}
