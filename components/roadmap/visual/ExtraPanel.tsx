"use client";

import { useEffect, useState } from "react";
import type { Resource } from "@/lib/roadmap-visual/graph-types";
import type { ProjectGuide } from "@/lib/roadmap-visual/project-guide";
import { send } from "@/components/roadmap/v2/api";
import { StationMark } from "./StationMark";

type Guide = { state: "loading" } | { state: "ready"; guide: ProjectGuide } | { state: "error"; message: string };

/** Fetches the AI-written guide for a project once per open; a retry is one button away. */
function useGuide(resourceId: string, career: "primary" | "plan-b", enabled: boolean) {
  const [guide, setGuide] = useState<Guide>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void send("POST", "/api/roadmap/project-guide", { resourceId, career }).then((r) => {
      if (cancelled) return;
      setGuide(r.ok && r.data?.guide ? { state: "ready", guide: r.data.guide as ProjectGuide } : { state: "error", message: r.error ?? "Couldn't load the guide." });
    });
    return () => { cancelled = true; };
  }, [resourceId, career, enabled, attempt]);
  return { guide, retry: () => { setGuide({ state: "loading" }); setAttempt((n) => n + 1); } };
}

const H = "text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-muted)]";

/** Popup for a project or certification: what it is, the steps to build it, the skills it adds, and what to show when it's done. */
export function ExtraPanel({ resource: r, career, onClose }: { resource: Resource; career: "primary" | "plan-b"; onClose: () => void }) {
  const isProject = r.kind === "PROJECT";
  const { guide, retry } = useGuide(r.id, career, isProject);
  const gained = guide.state === "ready" ? guide.guide.skillsGained : r.skills.map((skill) => ({ skill, how: "" }));
  return (
    <aside aria-label={isProject ? "Project details" : "Certification details"} className="flex h-full flex-col bg-white">
      <div className="flex items-start justify-between gap-3 bg-[var(--m-ink)] p-5 text-white">
        <div className="min-w-0">
          <p className="flex items-center gap-2 text-[11.5px] font-bold uppercase tracking-wide text-[var(--m-soft)]"><StationMark status="TARGET_MET" color="#fff" resource={isProject ? "PROJECT" : "CERTIFICATION"} size={16} />{isProject ? "Project to build" : "Certification to earn"}{r.difficulty ? ` · ${r.difficulty.toLowerCase()}` : ""}{r.hours ? ` · about ${r.hours} h` : ""}</p>
          <h2 className="mt-1.5 font-lp-display text-[24px] font-bold leading-tight">{r.title}</h2>
          {r.provider && <p className="mt-0.5 text-[13px] text-[var(--m-soft)]">{r.provider}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="shrink-0 rounded-md px-2.5 py-1 text-[18px] leading-none text-white hover:bg-white/15">×</button>
      </div>

      <div className="flex-1 space-y-6 overflow-y-auto p-5 font-lp-body text-[14px] leading-relaxed text-[var(--m-ink)]">
        <p>{(guide.state === "ready" && guide.guide.overview) || r.description}</p>

        {gained.length > 0 && (
          <section aria-labelledby="gain-h">
            <h3 id="gain-h" className={H}>Skills you&apos;ll gain</h3>
            <ul className="mt-2 space-y-2">
              {gained.map((s) => (
                <li key={s.skill} className="rounded-lg border border-[var(--m-rule)] p-3">
                  <span className="font-bold">{s.skill}</span>
                  {s.how && <span className="mt-0.5 block text-[13px] text-app-muted">{s.how}</span>}
                </li>
              ))}
            </ul>
          </section>
        )}

        {isProject && (
          <section aria-labelledby="steps-h">
            <h3 id="steps-h" className={H}>Step by step</h3>
            {guide.state === "loading" && <p role="status" className="mt-2 text-app-muted">Writing your step-by-step guide…</p>}
            {guide.state === "error" && (
              <p role="alert" className="mt-2 text-app-muted">{guide.message} <button type="button" onClick={retry} className="font-bold text-[var(--m-accent-ink)] underline">Try again</button></p>
            )}
            {guide.state === "ready" && (
              <ol className="mt-3">
                {guide.guide.steps.map((s, i, all) => (
                  <li key={i} className="relative flex gap-3 pb-5 last:pb-0">
                    {i < all.length - 1 && <span aria-hidden className="absolute left-[13px] top-7 h-[calc(100%-1.25rem)] w-[3px] rounded bg-[var(--m-ink)]" />}
                    <span className="relative z-10 flex h-7 w-7 shrink-0 items-center justify-center rounded-full border-[3px] border-[var(--m-ink)] bg-white text-[12px] font-bold">{i + 1}</span>
                    <div className="min-w-0">
                      <p className="font-bold">{s.title}</p>
                      <p className="mt-0.5 text-[13.5px]">{s.detail}</p>
                      <p className="mt-1 text-[12.5px] text-app-muted"><span className="font-bold text-[var(--m-ink)]">You&apos;ll have:</span> {s.deliverable}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            {guide.state === "ready" && <p className="mt-3 text-[12px] text-app-muted">Guide written by AI from the project description. Check anything important; it never changes your scores.</p>}
          </section>
        )}

        {(guide.state === "ready" ? guide.guide.showcase : r.evidence).length > 0 && (
          <section aria-labelledby="show-h">
            <h3 id="show-h" className={H}>What to show when you&apos;re done</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">{(guide.state === "ready" ? guide.guide.showcase : r.evidence).map((e) => <li key={e}>{e}</li>)}</ul>
          </section>
        )}

        {guide.state === "ready" && guide.guide.pitfalls.length > 0 && (
          <section aria-labelledby="pit-h">
            <h3 id="pit-h" className={H}>Watch out for</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">{guide.guide.pitfalls.map((e) => <li key={e}>{e}</li>)}</ul>
          </section>
        )}

        {!isProject && (r.cost || r.note) && <p className="text-app-muted">{[r.cost && `Cost: ${r.cost}`, r.note && `Duration: ${r.note}`].filter(Boolean).join(" · ")}</p>}
        {r.url && r.url.startsWith("https://") && <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-block rounded-md bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-white">Open the official page<span className="sr-only"> (opens in a new tab)</span></a>}
        {isProject && (
          <div className="rounded-xl bg-[var(--m-ground)] p-4">
            <p className="font-bold">Finished it? Make it count.</p>
            <p className="mt-1 text-[13px] text-app-muted">Add it to your portfolio with the repository or demo link. It then counts as evidence for the skills above.</p>
            <a href="/dashboard/portfolio" className="mt-3 inline-block rounded-md bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-white">Add it to my portfolio</a>
          </div>
        )}
      </div>
    </aside>
  );
}
