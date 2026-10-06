import Link from "next/link";
import { ArrowRight, CheckCircle2, ExternalLink, Info } from "lucide-react";
import type { NeedsInfoReason, Roadmap, RoadmapItem, Timing } from "@/lib/roadmap/build";

const REASON_COPY: Record<NeedsInfoReason, { text: string; href?: string; cta?: string }> = {
  no_role: { text: "No Arena domain role is available for you yet." },
  no_target_profile: { text: "This role doesn't have a readiness target defined yet." },
  year_unknown: { text: "Confirm your program years so we know which subjects are yours.", href: "/settings/direction", cta: "Confirm your years" },
  no_curriculum: { text: "Your college hasn't added its curriculum for your branch yet. We won't guess what it covers." },
  no_curriculum_for_regulation: { text: "Your college has published a curriculum for your branch, but not for your regulation. We won't show you a different regulation's subjects." },
  no_curriculum_for_year: { text: "Your college's curriculum doesn't include your current or next year yet." },
  no_confirmed_mapping: { text: "Your college has added subjects but hasn't linked them to skills yet, so we can't tell what they cover." },
};

const TIMING: Record<Timing, string> = { past: "earlier year", this_year: "this year", next_year: "next year" };
const ordinal = (n: number) => ({ 1: "1st", 2: "2nd", 3: "3rd" })[n as 1 | 2 | 3] ?? `${n}th`;

function Progress({ item }: { item: RoadmapItem }) {
  const pct = Math.min(100, Math.round((item.verifiedCount / item.minVerified) * 100));
  return (
    <div className="mt-2" aria-label={`${item.verifiedCount} of ${item.minVerified} verified tasks`}>
      <div className="h-1.5 w-full rounded-full bg-app-background">
        <div className="h-1.5 rounded-full bg-app-orange" style={{ width: `${pct}%` }} />
      </div>
      <p className="mt-1 font-lp-mono text-[11px] text-app-muted">
        {item.verifiedCount} of {item.minVerified} verified Arena tasks
      </p>
    </div>
  );
}

function Covering({ item }: { item: RoadmapItem }) {
  if (item.covering.length === 0) return null;
  return (
    <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">
      Your curriculum covers this in{" "}
      {item.covering.map((c, i) => (
        <span key={`${c.name}-${c.year}`}>
          {i > 0 && ", "}
          <strong className="text-app-charcoal">{c.name}</strong> ({ordinal(c.year)} year, {TIMING[c.timing]})
        </span>
      ))}
      .
    </p>
  );
}

function ArenaLink({ label }: { label: string }) {
  return (
    <Link href="/arena" className="mt-3 inline-flex items-center gap-1.5 font-lp-body text-[12.5px] font-medium text-app-blue hover:underline">
      {label} <ArrowRight size={13} />
    </Link>
  );
}

function Card({ item, children }: { item: RoadmapItem; children?: React.ReactNode }) {
  return (
    <li className="rounded-xl border border-app-border bg-white p-4">
      <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{item.areaName}</p>
      {children}
    </li>
  );
}

function Section({ title, blurb, empty, items, render }: { title: string; blurb: string; empty: string; items: RoadmapItem[]; render: (i: RoadmapItem) => React.ReactNode }) {
  return (
    <section>
      <h2 className="font-lp-display text-[16px] font-semibold text-app-charcoal">{title}</h2>
      <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{blurb}</p>
      {items.length === 0 ? (
        <p className="mt-3 rounded-lg border border-dashed border-app-border bg-white px-4 py-3 font-lp-body text-[12.5px] text-app-muted">{empty}</p>
      ) : (
        <ul className="mt-3 grid grid-cols-1 gap-3 md:grid-cols-2">{items.map(render)}</ul>
      )}
    </section>
  );
}

export function RoadmapView({ roadmap }: { roadmap: Roadmap }) {
  if (roadmap.status === "needs_info") {
    return (
      <div className="rounded-2xl border border-dashed border-app-border bg-white p-6" role="status">
        <p className="flex items-center gap-2 font-lp-display text-[16px] font-semibold text-app-charcoal">
          <Info size={17} className="text-app-orange" /> Your roadmap needs more information
        </p>
        <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
          We only show a roadmap we can back with real data — so nothing is shown yet, and it doesn&apos;t mean you have no gaps.
        </p>
        <ul className="mt-4 flex flex-col gap-2.5">
          {roadmap.reasons.map((r) => (
            <li key={r} className="font-lp-body text-[13px] text-app-charcoal">
              {REASON_COPY[r].text}{" "}
              {REASON_COPY[r].href && (
                <Link href={REASON_COPY[r].href!} className="text-app-blue hover:underline">
                  {REASON_COPY[r].cta}
                </Link>
              )}
            </li>
          ))}
        </ul>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <p className="font-lp-body text-[12.5px] text-app-muted">
        Target role: <strong className="text-app-charcoal">{roadmap.roleName}</strong> · You&apos;re in your {ordinal(roadmap.academicYear)} year. Based on the subjects your college has entered.
      </p>

      <Section
        title="You're on track"
        blurb="Skills you've proved with verified Arena work."
        empty="Nothing proved yet — the sections below show where to start."
        items={roadmap.affirm}
        render={(i) => (
          <Card key={i.areaKey} item={i}>
            <p className="mt-1 flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-success">
              <CheckCircle2 size={14} /> {i.beyondCurriculum ? "Proved on your own — your curriculum doesn't cover it" : "Covered by your curriculum and proved in Arena"}
            </p>
            <Covering item={i} />
            <Progress item={i} />
          </Card>
        )}
      />

      <Section
        title="Engage with your curriculum, then prove it"
        blurb="Your college already teaches these — treat class as practice, then show it with verified Arena work."
        empty="No skills in this group."
        items={roadmap.engage}
        render={(i) => (
          <Card key={i.areaKey} item={i}>
            <Covering item={i} />
            <Progress item={i} />
            <ArenaLink label={`Complete ${i.arenaTasksRemaining} more verified ${i.areaName} ${i.arenaTasksRemaining === 1 ? "task" : "tasks"}`} />
          </Card>
        )}
      />

      <Section
        title="Not in your curriculum — build these yourself"
        blurb="Your college's subjects don't cover these skills. Arena practice is the fastest proof."
        empty="No skills in this group."
        items={roadmap.external}
        render={(i) => (
          <Card key={i.areaKey} item={i}>
            <Progress item={i} />
            <ArenaLink label={`Complete ${i.arenaTasksRemaining} verified ${i.areaName} ${i.arenaTasksRemaining === 1 ? "task" : "tasks"} in Arena`} />
            {i.resources.length > 0 && (
              <ul className="mt-3 flex flex-col gap-1.5 border-t border-app-border pt-3">
                {i.resources.map((r) => (
                  <li key={r.title} className="font-lp-body text-[12.5px] text-app-muted">
                    <span className="font-lp-mono text-[10.5px] uppercase text-app-muted">{r.kind}</span>{" "}
                    {r.url ? (
                      <a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-medium text-app-blue hover:underline">
                        {r.title} <ExternalLink size={11} />
                      </a>
                    ) : (
                      <span className="font-medium text-app-charcoal">{r.title}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </Card>
        )}
      />
    </div>
  );
}
