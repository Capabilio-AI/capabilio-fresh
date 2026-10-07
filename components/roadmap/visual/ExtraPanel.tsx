"use client";

import type { GraphNode } from "@/lib/roadmap-visual/graph-types";

/** Popup for a project or certification placed on the map: what it is, what it proves, which topics it builds, and where to start. */
export function ExtraPanel({ node, onClose }: { node: GraphNode; onClose: () => void }) {
  const r = node.resource!;
  const isProject = r.kind === "PROJECT";
  return (
    <aside aria-label={isProject ? "Project details" : "Certification details"} className="flex h-full flex-col">
      <div className="flex items-start justify-between gap-3 border-b border-app-border p-5">
        <div>
          <p className="font-lp-mono text-[10.5px] uppercase text-app-muted">{isProject ? "Project to build" : "Certification to earn"}{r.difficulty ? ` · ${r.difficulty.toLowerCase()}` : ""}</p>
          <h2 className="mt-1 font-lp-display text-[24px] font-semibold leading-tight text-app-charcoal">{r.title}</h2>
          {r.provider && <p className="mt-0.5 font-lp-body text-[13px] text-app-muted">{r.provider}</p>}
        </div>
        <button type="button" onClick={onClose} aria-label="Close details" className="rounded-md px-2 py-1 text-app-muted hover:bg-app-background focus-visible:outline-2 focus-visible:outline-app-blue">✕</button>
      </div>
      <div className="flex-1 space-y-5 overflow-y-auto p-5 font-lp-body text-[14px] text-app-charcoal">
        {r.description && <p>{r.description}</p>}
        {r.skills.length > 0 && (
          <section>
            <h3 className="font-lp-mono text-[10.5px] uppercase text-app-muted">Builds these skills</h3>
            <p className="mt-1.5 flex flex-wrap gap-1.5">{r.skills.map((s) => <span key={s} className="rounded-full border border-black bg-[#fde9a8] px-2.5 py-0.5 text-[12.5px]">{s}</span>)}</p>
          </section>
        )}
        {r.evidence.length > 0 && (
          <section>
            <h3 className="font-lp-mono text-[10.5px] uppercase text-app-muted">What to show when you&apos;re done</h3>
            <ul className="mt-1.5 list-disc space-y-1 pl-5">{r.evidence.map((e) => <li key={e}>{e}</li>)}</ul>
          </section>
        )}
        {!isProject && (r.cost || r.note) && <p className="text-app-muted">{[r.cost && `Cost: ${r.cost}`, r.note && `Duration: ${r.note}`].filter(Boolean).join(" · ")}</p>}
        {r.url && r.url.startsWith("https://") && <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-block rounded-md bg-app-charcoal px-4 py-2 text-[13px] text-white">Open the official page<span className="sr-only"> (opens in a new tab)</span></a>}
        {isProject && (
          <div className="rounded-xl border-2 border-black bg-[#fffbe6] p-4">
            <p className="font-medium">Do this project, then showcase it</p>
            <p className="mt-1 text-[13px] text-app-muted">When it&apos;s finished, add it to your portfolio with the repository or demo link. It then counts as evidence for the skills above.</p>
            <a href="/dashboard/portfolio" className="mt-3 inline-block rounded-md bg-[#fff200] px-4 py-2 text-[13px] font-semibold text-black outline outline-2 outline-black">Add it to my portfolio</a>
          </div>
        )}
      </div>
    </aside>
  );
}
