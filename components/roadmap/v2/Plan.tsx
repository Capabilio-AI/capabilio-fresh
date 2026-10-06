import type { RoadmapView } from "@/lib/roadmap-engine/read";
import { Card, Empty, Ext, Pill, Section } from "./ui";

const TIER: Record<string, { label: string; tone: string }> = {
  CRITICAL: { label: "Critical for this career", tone: "bg-app-rose-container text-app-rose" },
  HIGH: { label: "High priority", tone: "bg-app-warning-container text-app-warning" },
  MODERATE: { label: "Moderate", tone: "bg-app-blue-container text-app-blue" },
  USEFUL: { label: "Useful", tone: "bg-app-attention-container text-app-attention" },
};
const SCHEDULE: Record<string, string> = { PAST: "Earlier year", CURRENT: "This semester", UPCOMING: "Coming up", FUTURE: "Later" };
const HORIZON: [string, string][] = [["NOW", "Now"], ["NEXT", "Next"], ["THIS_YEAR", "This year"], ["NEXT_YEAR", "Next year"], ["LONG_TERM", "Longer term"]];
const STATUS: Record<string, string> = { NOT_STARTED: "Not started", IN_PROGRESS: "In progress", COMPLETED: "Completed", BLOCKED: "Do after its prerequisite" };

export function Subjects({ subjects, mandatoryNote }: { subjects: RoadmapView["subjects"]; mandatoryNote: string }) {
  return (
    <Section id="subjects" title="Subjects that matter most for this career" blurb={mandatoryNote}>
      {subjects.length === 0 ? <Empty>None of your college&apos;s confirmed subjects map to this career&apos;s skills yet, so there is nothing to prioritise. That doesn&apos;t change what you must study.</Empty> : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {subjects.map((s) => (
            <Card key={`${s.courseId ?? s.title}-${s.year}`}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{s.title}</p>
                <Pill tone={TIER[s.tier]?.tone}>{TIER[s.tier]?.label ?? s.tier}</Pill>
              </div>
              <p className="mt-1 font-lp-mono text-[11px] text-app-muted"><span aria-label={`${s.stars} out of 5 stars`}>{"★".repeat(s.stars)}{"☆".repeat(5 - s.stars)}</span> · Year {s.year}{s.semester ? `, semester ${s.semester}` : ""} · {SCHEDULE[s.schedule] ?? s.schedule}</p>
              <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">Builds {s.facts.skillNames.join(", ")}{s.facts.outcomeCount > 0 ? ` · ${s.facts.outcomeCount} confirmed outcome${s.facts.outcomeCount === 1 ? "" : "s"}` : ""}.</p>
              {s.aiExplanation && <p className="mt-2 border-t border-app-border pt-2 font-lp-body text-[12.5px] text-app-charcoal">{s.aiExplanation} <span className="font-lp-mono text-[10px] uppercase text-app-muted">AI-written from your data</span></p>}
            </Card>
          ))}
        </ul>
      )}
    </Section>
  );
}

export function Resources({ view }: { view: RoadmapView }) {
  const n = view.notes as { learningNotConfigured?: { skillId?: string; skillName: string; message: string }[]; certificationNote?: string | null; projectNote?: string | null; arenaNote?: string | null };
  return (
    <>
      <Section id="learning" title="Learning resources" blurb="Only resources your institution or Capabilio has added — never invented.">
        {view.learning.length === 0 ? <Empty>No learning resource is configured for your current gaps yet.</Empty> : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
            {view.learning.map((l) => <Card key={`${l.skillName}-${l.title}`}><p className="font-lp-body text-[14px] font-semibold"><Ext href={l.url}>{l.title}</Ext></p><p className="mt-1 font-lp-mono text-[11px] text-app-muted">{l.provider} · for {l.skillName}{l.estimatedHours ? ` · ~${l.estimatedHours}h` : ""}{l.startsNow ? " · you can start now" : ""}</p><p className="mt-1 font-lp-body text-[12.5px] text-app-muted">{l.reason}</p></Card>)}
          </ul>
        )}
        {(n.learningNotConfigured ?? []).length > 0 && <ul className="mt-2 list-disc pl-5 font-lp-body text-[12px] text-app-muted">{n.learningNotConfigured!.map((x) => <li key={x.skillName}>{x.message}</li>)}</ul>}
      </Section>
      <Section id="certs" title="Certifications" blurb="Optional extras that support this career. They never replace your degree.">
        {view.certifications.length === 0 ? <Empty>{n.certificationNote ?? "Certification recommendation not configured yet."}</Empty> : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{view.certifications.map((c) => <Card key={c.name}><p className="font-lp-body text-[14px] font-semibold"><Ext href={c.url}>{c.name}</Ext></p><p className="mt-1 font-lp-mono text-[11px] text-app-muted">{c.provider} · {c.relevance.toLowerCase()}</p></Card>)}</ul>
        )}
      </Section>
      <Section id="projects" title="Projects" blurb="Hands-on work that proves the skills you're missing.">
        {view.projects.length === 0 ? <Empty>{n.projectNote ?? "Project recommendations aren't configured yet."}</Empty> : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{view.projects.map((p) => <Card key={p.title}><p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{p.title}</p><p className="mt-1 font-lp-mono text-[11px] text-app-muted">{p.difficulty}{p.isAiRecommendation ? " · AI-suggested idea for you" : ""}</p></Card>)}</ul>
        )}
      </Section>
      <Section id="arena" title="Arena practice" blurb="Verified Arena work is the strongest proof of a skill.">
        {view.arena.length === 0 ? <Empty>{n.arenaNote ?? "No Arena challenge is tagged with your remaining gaps yet."}</Empty> : (
          <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">{view.arena.map((a) => <Card key={a.title}><p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{a.title}</p><p className="mt-1 font-lp-mono text-[11px] text-app-muted">{a.difficulty}</p></Card>)}</ul>
        )}
      </Section>
    </>
  );
}

export function Timeline({ milestones }: { milestones: RoadmapView["milestones"] }) {
  return (
    <Section id="timeline" title="Your timeline" blurb="What to focus on and when, based on your year and the subjects ahead of you. A skill is never scheduled before the one it builds on.">
      {milestones.length === 0 ? <Empty>There is nothing to schedule yet.</Empty> : (
        <ol className="flex flex-col gap-4">
          {HORIZON.map(([key, label]) => {
            const items = milestones.filter((m) => m.horizon === key);
            if (items.length === 0) return null;
            return (
              <li key={key}>
                <h3 className="font-lp-mono text-[11px] uppercase text-app-muted">{label}</h3>
                <ul className="mt-1.5 flex flex-col gap-2">
                  {items.map((m, i) => (
                    <li key={`${m.refId}-${i}`} className="rounded-lg border border-app-border bg-white px-3 py-2.5">
                      <p className="font-lp-body text-[13px] font-medium text-app-charcoal">{m.title} <span className="font-lp-mono text-[10.5px] uppercase text-app-muted">{m.kind.toLowerCase()} · {STATUS[m.status] ?? m.status}</span></p>
                      <p className="font-lp-body text-[12px] text-app-muted">{m.reason}{m.optionalExploration ? " · optional exploration" : ""}</p>
                    </li>
                  ))}
                </ul>
              </li>
            );
          })}
        </ol>
      )}
    </Section>
  );
}
