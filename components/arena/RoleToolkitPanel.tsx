import type { ReactNode } from "react";
import type { RoleToolkit, WorkstationTier } from "@/lib/arena-roles/toolkit/types";

/** Tier letter, what it means, and its colour. The letter and the words carry the meaning; colour only repeats it. */
export const TIER_LABEL: Record<WorkstationTier, { name: string; meaning: string; className: string }> = {
  R: { name: "Real engine", meaning: "The real engine runs your work.", className: "bg-app-success-container text-app-success" },
  S: { name: "Simulator", meaning: "A deterministic simulator of the tool's rules.", className: "bg-app-blue-container text-app-blue" },
  A: { name: "Validated artifact", meaning: "Your document is checked against rules.", className: "bg-[#F1F3F4] text-[#3C4043]" },
};

function Block({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-6 first:mt-0">
      <h3 className="font-lp-body text-[12px] font-semibold uppercase tracking-[0.06em] text-app-muted">{title}</h3>
      <div className="mt-2">{children}</div>
    </section>
  );
}

/**
 * What a role's workstation is before the student starts: the tools it mirrors and how honestly each is assessed, what is preloaded, a first week as
 * Arena tasks, what a recruiter can open, and what is not assessed. Renders only the descriptor it is given; it never fills gaps.
 */
export function RoleToolkitPanel({ toolkit }: { toolkit: RoleToolkit }) {
  return (
    <details open className="group mb-6 rounded-2xl border border-[var(--m-rule)] bg-white p-5 sm:p-6">
      <summary className="flex cursor-pointer list-none items-start justify-between gap-3 rounded-md focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-app-blue [&::-webkit-details-marker]:hidden">
        <span className="min-w-0">
          <span className="block font-lp-body text-[12px] text-app-muted">
            {toolkit.stream} · {toolkit.roleId}
          </span>
          <span className="mt-0.5 block font-lp-display text-[20px] font-bold leading-snug text-[var(--m-ink)]">Your toolkit</span>
          <span className="mt-1 block font-lp-body text-[13.5px] text-[var(--m-ink)]">{toolkit.headline}</span>
        </span>
        <span aria-hidden className="mt-1 shrink-0 font-lp-body text-[12px] font-semibold text-app-muted group-open:hidden">Show</span>
        <span aria-hidden className="mt-1 hidden shrink-0 font-lp-body text-[12px] font-semibold text-app-muted group-open:inline">Hide</span>
      </summary>

      <div className="mt-5 border-t border-[var(--m-rule)] pt-5">
        <Block title="Workstations">
          <ul className="grid gap-3 sm:grid-cols-2">
            {toolkit.workstations.map((w) => {
              const tier = TIER_LABEL[w.tier];
              return (
                <li key={`${w.toolType}-${w.name}`} className="rounded-xl border border-[var(--m-rule)] p-4">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{w.name}</p>
                    <span title={tier.meaning} className={`rounded-full px-2.5 py-0.5 font-lp-body text-[11.5px] font-semibold ${tier.className}`}>
                      {w.tier} · {tier.name}
                    </span>
                  </div>
                  <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">Mirrors {w.mirrors.join(", ")}</p>
                  <p className="mt-2 font-lp-body text-[13px] text-[var(--m-ink)]">{w.summary}</p>
                  <p className="mt-2 font-lp-body text-[12px] text-app-muted">
                    {w.runsIn === "browser" ? "Runs in your browser; the server grades the result." : "Runs on our server."} {tier.meaning}
                  </p>
                </li>
              );
            })}
          </ul>
        </Block>

        <Block title="Already set up for you">
          <dl className="grid gap-x-6 gap-y-2 sm:grid-cols-2">
            {toolkit.environment.map((e) => (
              <div key={e.label} className="min-w-0">
                <dt className="font-lp-body text-[13px] font-semibold text-[var(--m-ink)]">{e.label}</dt>
                <dd className="font-lp-body text-[12.5px] text-app-muted">{e.detail}</dd>
              </div>
            ))}
          </dl>
        </Block>

        <Block title="Your first week">
          <ol className="flex flex-col gap-1.5">
            {toolkit.firstWeek.map((task, i) => (
              <li key={task} className="flex gap-3 font-lp-body text-[13px] text-[var(--m-ink)]">
                <span className="w-5 shrink-0 text-right font-semibold tabular-nums text-app-muted">{i + 1}.</span>
                <span>{task}</span>
              </li>
            ))}
          </ol>
        </Block>

        <Block title="What recruiters can open">
          <ul className="list-disc space-y-1 pl-5 font-lp-body text-[13px] text-[var(--m-ink)]">
            {toolkit.portfolioArtifacts.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
          <p className="mt-2 font-lp-body text-[12px] text-app-muted">Only graded attempts appear, and only if you make your portfolio public.</p>
        </Block>

        <Block title="What this does not assess yet">
          <ul className="list-disc space-y-1 pl-5 font-lp-body text-[13px] text-app-muted">
            {toolkit.honestLimits.map((l) => (
              <li key={l}>{l}</li>
            ))}
          </ul>
        </Block>
      </div>
    </details>
  );
}
