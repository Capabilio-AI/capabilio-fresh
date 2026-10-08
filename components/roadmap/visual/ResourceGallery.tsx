"use client";

import { useState } from "react";
import type { Resource } from "@/lib/roadmap-visual/graph-types";
import { Drawer } from "@/components/metro/Drawer";
import { ExtraPanel } from "./ExtraPanel";
import { StationMark } from "./StationMark";

const LEVEL: Record<string, number> = { EASY: 1, BEGINNER: 1, MEDIUM: 2, INTERMEDIATE: 2, HARD: 3, ADVANCED: 3 };

function Bars({ difficulty }: { difficulty: string | null }) {
  const n = LEVEL[(difficulty ?? "").toUpperCase()] ?? 0;
  if (!n) return null;
  return (
    <span className="flex items-center gap-1.5 text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]">
      <span aria-hidden className="flex items-end gap-0.5">{[1, 2, 3].map((i) => <span key={i} className={`w-1.5 rounded-sm ${i <= n ? "bg-[var(--m-ink)]" : "bg-[var(--m-rule)]"}`} style={{ height: 4 + i * 3 }} />)}</span>
      {difficulty!.toLowerCase()}
    </span>
  );
}

/** Project and certification cards. A card opens the full guide: what it is, the steps, and the skills it adds. */
export function ResourceGallery({ resources, career, emptyText }: { resources: Resource[]; career: "primary" | "plan-b"; emptyText: string }) {
  const [open, setOpen] = useState<Resource | null>(null);
  if (resources.length === 0) {
    return <p className="rounded-xl border border-dashed border-[var(--m-off)] bg-white px-6 py-10 text-center font-lp-body text-[14px] text-app-muted">{emptyText}</p>;
  }
  return (
    <>
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {resources.map((r) => {
          const project = r.kind === "PROJECT";
          return (
            <li key={r.id}>
              <button type="button" onClick={() => setOpen(r)} className="group flex h-full w-full flex-col gap-2.5 rounded-xl border border-[var(--m-rule)] bg-white p-4 text-left transition-[transform,box-shadow,border-color] duration-200 ease-out hover:-translate-y-0.5 hover:border-[var(--m-ink)] hover:shadow-[0_8px_20px_-8px_rgba(20,20,20,0.3)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                <span className="flex items-center justify-between gap-2">
                  <span className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]"><StationMark status="NOT_STARTED" resource={project ? "PROJECT" : "CERTIFICATION"} size={18} />{project ? "Project" : "Certification"}</span>
                  {project ? <Bars difficulty={r.difficulty} /> : r.cost && <span className="text-[11.5px] font-bold text-[var(--m-muted)]">{r.cost}</span>}
                </span>
                <span className="font-lp-display text-[17px] font-bold leading-snug text-[var(--m-ink)]">{r.title}</span>
                {r.description && <span className="line-clamp-2 font-lp-body text-[13px] leading-snug text-app-muted">{r.description}</span>}
                {r.skills.length > 0 && (
                  <span className="flex flex-wrap gap-1.5">
                    {r.skills.slice(0, 3).map((s) => <span key={s} className="rounded-full bg-[var(--m-ground)] px-2.5 py-0.5 text-[12px] font-bold text-[var(--m-ink)]">{s}</span>)}
                    {r.skills.length > 3 && <span className="px-1 py-0.5 text-[12px] text-app-muted">+{r.skills.length - 3}</span>}
                  </span>
                )}
                <span className="mt-auto flex items-center justify-between pt-1 text-[12.5px] font-bold text-[var(--m-accent-ink)]">
                  <span>{project ? "Steps, skills and what to show" : "Details and how to earn it"}</span>
                  <span aria-hidden className="transition-transform duration-200 group-hover:translate-x-1 motion-reduce:transition-none">→</span>
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      {open && <Drawer onClose={() => setOpen(null)}><ExtraPanel key={open.id} resource={open} career={career} onClose={() => setOpen(null)} /></Drawer>}
    </>
  );
}
