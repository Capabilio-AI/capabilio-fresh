"use client";

import { useEffect, useState } from "react";
import type { Resource } from "@/lib/roadmap-visual/graph-types";
import type { ProjectGuideView } from "@/lib/roadmap-visual/project-guide";
import { send } from "@/components/roadmap/v2/api";
import { StationMark } from "./StationMark";
import { generateTables, seedOf, toCsv, type DatasetSpec } from "@/lib/roadmap-visual/dataset";

type Guide = { state: "loading" } | { state: "ready"; guide: ProjectGuideView } | { state: "error"; message: string };

/** Fetches the AI-written guide for a project once per open; a retry is one button away. */
function useGuide(resourceId: string, career: "primary" | "plan-b", enabled: boolean) {
  const [guide, setGuide] = useState<Guide>({ state: "loading" });
  const [attempt, setAttempt] = useState(0);
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    void send("POST", "/api/roadmap/project-guide", { resourceId, career }).then((r) => {
      if (cancelled) return;
      setGuide(r.ok && r.data?.guide ? { state: "ready", guide: r.data.guide as ProjectGuideView } : { state: "error", message: r.error ?? "Couldn't load the guide." });
    });
    return () => { cancelled = true; };
  }, [resourceId, career, enabled, attempt]);
  return { guide, retry: () => { setGuide({ state: "loading" }); setAttempt((n) => n + 1); } };
}

/** Builds the CSV in the browser from the spec (same seed, same file) and downloads it. Nothing is stored or fetched. */
function downloadCsv(spec: DatasetSpec, resourceId: string) {
  const table = generateTables([spec], seedOf(`${resourceId}:${spec.name}`))[0];
  const url = URL.createObjectURL(new Blob([toCsv(table)], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = `${spec.name}.csv`;
  a.click();
  URL.revokeObjectURL(url);
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

        {isProject && guide.state === "ready" && guide.guide.scenario && (
          <section aria-labelledby="scn-h">
            <h3 id="scn-h" className={H}>The situation</h3>
            <p className="mt-1.5 rounded-lg bg-[var(--m-ground)] p-3.5">{guide.guide.scenario}</p>
          </section>
        )}

        {isProject && guide.state === "ready" && guide.guide.questions.length > 0 && (
          <section aria-labelledby="qs-h">
            <h3 id="qs-h" className={H}>Questions your work must answer</h3>
            <ol className="mt-1.5 list-decimal space-y-1 pl-5">{guide.guide.questions.map((q) => <li key={q}>{q}</li>)}</ol>
          </section>
        )}

        {isProject && guide.state === "ready" && guide.guide.tools.length > 0 && (
          <section aria-labelledby="tools-h">
            <h3 id="tools-h" className={H}>What you&apos;ll need</h3>
            <ul className="mt-2 flex flex-wrap gap-2">{guide.guide.tools.map((t) => <li key={t} className="rounded-full border border-[var(--m-rule)] px-3 py-1 text-[12.5px]">{t}</li>)}</ul>
          </section>
        )}

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

        {isProject && guide.state === "ready" && guide.guide.datasets.length > 0 && (
          <section aria-labelledby="data-h">
            <h3 id="data-h" className={H}>Data you&apos;ll use</h3>
            <p className="mt-1 text-[13px] text-app-muted">Practice data made for this project, so you can start right away. It is generated, not real, so do not quote it as findings.</p>
            <ul className="mt-3 space-y-3">
              {guide.guide.datasets.map((d) => (
                <li key={d.name} className="rounded-lg border border-[var(--m-rule)] p-3.5">
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="font-bold">{d.name}.csv <span className="font-normal text-app-muted">· {d.rows.toLocaleString("en-IN")} rows · {d.columns.length} columns</span></p>
                      <p className="mt-0.5 text-[13px] text-app-muted">{d.description}</p>
                    </div>
                    <button type="button" onClick={() => downloadCsv(d, r.id)} className="shrink-0 rounded-md bg-[var(--m-ink)] px-3.5 py-2 text-[13px] font-bold text-white">Download CSV</button>
                  </div>
                  <ul className="mt-2.5 grid gap-x-4 gap-y-1 text-[12.5px] sm:grid-cols-2">
                    {d.columns.map((c) => (
                      <li key={c.name}><span className="font-bold">{c.name}</span> <span className="text-app-muted">({c.type}){c.description ? `: ${c.description}` : ""}</span></li>
                    ))}
                  </ul>
                </li>
              ))}
            </ul>
            {guide.guide.realDataIdeas.length > 0 && (
              <p className="mt-3 text-[12.5px] text-app-muted"><span className="font-bold text-[var(--m-ink)]">Want real data too?</span> Look for: {guide.guide.realDataIdeas.join("; ")}.</p>
            )}
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

        {isProject && guide.state === "ready" && guide.guide.checklist.length > 0 && (
          <section aria-labelledby="chk-h">
            <h3 id="chk-h" className={H}>You&apos;re done when</h3>
            <ul className="mt-1.5 space-y-1.5">{guide.guide.checklist.map((c) => <li key={c} className="flex gap-2"><span aria-hidden className="mt-1 h-3.5 w-3.5 shrink-0 rounded border-2 border-[var(--m-ink)]" />{c}</li>)}</ul>
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
