"use client";

import Link from "next/link";
import { useState } from "react";
import type { SubjectNode, SubjectStatus } from "@/lib/roadmap-visual/syllabus-map";

const STATUS: Record<SubjectStatus, { label: string; bar: string; text: string }> = {
  PROVEN: { label: "Proven", bar: "#0d7a45", text: "text-[#0d7a45]" },
  IN_PROGRESS: { label: "In progress", bar: "#b45309", text: "text-[#b45309]" },
  NOT_PROVEN: { label: "Not proven yet", bar: "var(--m-ink)", text: "text-[var(--m-muted)]" },
  NOT_MAPPED: { label: "Not tracked here", bar: "#8795ab", text: "text-[var(--m-muted)]" },
};
const TIMING = { COMPLETED: "Completed", CURRENT: "This semester", UPCOMING: "Upcoming", UNKNOWN: "" } as const;
const termLabel = (s: SubjectNode) => (s.semester ? `Semester ${(s.year - 1) * 2 + s.semester}` : `Year ${s.year}`);

function byTerm(subjects: SubjectNode[]) {
  const terms: { label: string; items: SubjectNode[] }[] = [];
  for (const s of subjects) {
    const label = termLabel(s);
    const last = terms.at(-1);
    if (last?.label === label) last.items.push(s);
    else terms.push({ label, items: [s] });
  }
  return terms;
}

/** One segment per career topic the subject teaches: filled when the topic is at target, so the bar is the evidence, not a tick box. */
function ProofBar({ s }: { s: SubjectNode }) {
  if (s.topics.length === 0) return <span aria-hidden className="block h-2 rounded-full border border-dashed border-[var(--m-off)]" />;
  return (
    <span aria-hidden className="flex gap-0.5">
      {s.topics.map((t) => <span key={t.nodeKey} className={`h-2 min-w-1 flex-1 rounded-sm ${t.met ? "bg-[#0d7a45]" : (t.level ?? 0) > 0 ? "bg-[#e0b36a]" : "bg-[var(--m-rule)]"}`} />)}
    </span>
  );
}

/**
 * The student's degree as a timetable: one column per term, left to right, a subject tile per course. The bar on each tile has one segment per
 * career topic it teaches. A subject is Proven only when those topics are proven by Arena passes or projects; nothing here can be ticked by hand.
 */
export function SyllabusMap({ syllabus, careerName, onOpenTopic }: { syllabus: SubjectNode[]; careerName: string; onOpenTopic: (nodeKey: string) => void }) {
  const [open, setOpen] = useState<string | null>(null);
  if (syllabus.length === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--m-rule)] bg-white px-6 py-10 text-center font-lp-body text-[13.5px] text-app-muted">Your college hasn&apos;t published subjects for your branch yet. They appear here as soon as it does.</p>;
  }
  const terms = byTerm(syllabus);
  const tracked = syllabus.filter((s) => s.status !== "NOT_MAPPED").length;
  const chosen = syllabus.find((s) => s.courseId === open) ?? null;

  return (
    <section aria-label="College subjects" className="space-y-4">
      <p className="max-w-[70ch] font-lp-body text-[13.5px] text-app-muted">
        Your degree, term by term. {tracked} of {syllabus.length} subjects teach topics on the {careerName} roadmap. Each bar has one segment per career topic; a subject is Proven when every segment is filled by Arena passes or projects. You cannot tick it off by hand.
      </p>

      <div className="overflow-x-auto rounded-xl border border-[var(--m-rule)] bg-white p-4">
        <ol className="flex min-w-max gap-3">
          {terms.map((term) => {
            const current = term.items.some((s) => s.timing === "CURRENT");
            const proven = term.items.filter((s) => s.status === "PROVEN").length;
            const mapped = term.items.filter((s) => s.status !== "NOT_MAPPED").length;
            return (
              <li key={term.label} className="w-[236px] shrink-0">
                <div className={`mb-2 rounded-lg px-3 py-2 ${current ? "bg-[var(--m-ink)] text-white" : "bg-[var(--m-ground)] text-[var(--m-ink)]"}`}>
                  <p className="flex items-center justify-between gap-2 text-[13.5px] font-bold">{term.label}{current && <span className="rounded bg-white px-1.5 py-0.5 text-[10.5px] uppercase tracking-wide text-[var(--m-ink)]">You are here</span>}</p>
                  <p className={`text-[12px] ${current ? "text-[var(--m-soft)]" : "text-app-muted"}`}>{mapped === 0 ? "No tracked subjects" : `${proven} of ${mapped} proven`}</p>
                </div>
                <ul className="space-y-2">
                  {term.items.map((s) => {
                    const st = STATUS[s.status];
                    const sel = open === s.courseId;
                    return (
                      <li key={s.courseId}>
                        <button type="button" aria-pressed={sel} onClick={() => setOpen(sel ? null : s.courseId)} className={`w-full space-y-1.5 rounded-lg border bg-white p-3 text-left transition-[transform,box-shadow] duration-150 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0 ${sel ? "border-[var(--m-ink)] shadow-[0_0_0_2px_var(--m-ink)]" : "border-[var(--m-rule)]"} ${s.status === "NOT_MAPPED" ? "opacity-80" : ""}`}>
                          <span className="block text-[13.5px] font-bold leading-snug text-[var(--m-ink)]">{s.title}</span>
                          <ProofBar s={s} />
                          <span className="flex items-center justify-between gap-2 text-[11.5px]">
                            <span className={`font-bold ${st.text}`}>{st.label}</span>
                            <span className="text-app-muted">{s.topics.length > 0 ? `${s.provenCount}/${s.topics.length} topics` : TIMING[s.timing]}</span>
                          </span>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </li>
            );
          })}
        </ol>
      </div>

      {chosen && (
        <div role="region" aria-label={`${chosen.title} details`} className="rounded-xl border-2 border-[var(--m-ink)] bg-white p-5 font-lp-body text-[13.5px] text-[var(--m-ink)]">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-[11.5px] font-bold uppercase tracking-wide text-app-muted">{termLabel(chosen)}{TIMING[chosen.timing] ? ` · ${TIMING[chosen.timing]}` : ""}{chosen.code ? ` · ${chosen.code}` : ""}</p>
              <h3 className="font-lp-display text-[20px] font-bold leading-tight">{chosen.title}</h3>
            </div>
            <button type="button" onClick={() => setOpen(null)} className="rounded-md border border-[var(--m-rule)] px-3 py-1 text-[12.5px] font-bold hover:border-[var(--m-ink)]">Close</button>
          </div>
          <div className="mt-4 grid gap-6 md:grid-cols-2">
            <div>
              <p className="font-bold">Career topics this subject teaches</p>
              {chosen.topics.length === 0 ? <p className="mt-1 text-app-muted">None of this career&apos;s topics. It is still part of your degree.</p> : (
                <ul className="mt-2 space-y-1.5">
                  {chosen.topics.map((t) => (
                    <li key={t.nodeKey} className="flex items-center justify-between gap-3">
                      <button type="button" onClick={() => onOpenTopic(t.nodeKey)} className="text-left font-bold text-[var(--m-accent-ink)] hover:underline">{t.title}</button>
                      <span className="shrink-0 text-[12px] text-app-muted">{t.met ? "proven" : t.level === null ? "not assessed" : `${t.level} of ${t.target}`}</span>
                    </li>
                  ))}
                </ul>
              )}
              {chosen.status !== "PROVEN" && chosen.topics.length > 0 && <p className="mt-3 text-app-muted">To prove it, <Link href="/arena" className="font-bold text-[var(--m-accent-ink)] hover:underline">pass Arena challenges</Link> or build a project for these topics.</p>}
            </div>
            {chosen.units.length > 0 && (
              <div>
                <p className="font-bold">Units</p>
                <ol className="mt-2 space-y-1 text-app-muted">{chosen.units.map((u) => <li key={u.no}><span className="font-bold text-[var(--m-ink)]">{u.no}.</span> {u.title}</li>)}</ol>
              </div>
            )}
          </div>
        </div>
      )}
    </section>
  );
}
