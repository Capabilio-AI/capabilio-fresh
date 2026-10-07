"use client";

import type { GraphNode } from "@/lib/roadmap-visual/graph-types";

/** Hands-on projects for the chosen career, up front: do them, then showcase them in the portfolio as evidence for the skills they build. */
export function ProjectsStrip({ nodes, careerName, onOpen }: { nodes: GraphNode[]; careerName: string; onOpen: (key: string) => void }) {
  const projects = nodes.filter((n) => n.resource?.kind === "PROJECT");
  const certs = nodes.filter((n) => n.resource?.kind === "CERTIFICATION");
  if (projects.length + certs.length === 0) return null;
  return (
    <section aria-labelledby="proj-h" className="rounded-xl border-2 border-black bg-[#fffbe6] p-4 shadow-[3px_3px_0_#000]">
      <h2 id="proj-h" className="font-lp-display text-[18px] font-semibold text-black">Projects to build for {careerName}</h2>
      <p className="font-lp-body text-[13px] text-app-charcoal">Practical work that builds the skills on this map. Finish one, then add it to your portfolio as proof.</p>
      <ul className="mt-3 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
        {projects.map((p) => (
          <li key={p.key}>
            <button type="button" onClick={() => onOpen(p.key)} className="h-full w-full rounded-lg border-2 border-black bg-white p-3 text-left shadow-[2px_2px_0_#000] hover:-translate-y-px focus-visible:outline-2 focus-visible:outline-app-blue">
              <span className="font-lp-mono text-[10px] uppercase text-app-muted">▣ {p.resource!.difficulty?.toLowerCase()}</span>
              <span className="mt-0.5 block font-lp-body text-[14px] font-semibold text-black">{p.title}</span>
              <span className="mt-1 block font-lp-body text-[12px] text-app-muted">Builds: {p.resource!.skills.slice(0, 3).join(", ")}</span>
            </button>
          </li>
        ))}
      </ul>
      {certs.length > 0 && (
        <p className="mt-3 font-lp-body text-[12.5px] text-app-charcoal">Certifications to earn: {certs.map((c, i) => <span key={c.key}>{i ? " · " : ""}<button type="button" onClick={() => onOpen(c.key)} className="text-app-blue underline">{c.title}</button></span>)}</p>
      )}
    </section>
  );
}
