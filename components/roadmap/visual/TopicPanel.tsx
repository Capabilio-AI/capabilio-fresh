"use client";

import { useEffect, useState } from "react";
import type { NodeExplanation } from "@/lib/roadmap-visual/explain-node";
import type { Resource } from "@/lib/roadmap-visual/graph-types";
import { send } from "@/components/roadmap/v2/api";
import { COVERAGE_LABEL, STATUS_META } from "./meta";
import { AskBar, LearnCard, TutorAnswer, useTutor } from "./LearnWithAI";

type Load = { s: "loading" } | { s: "error"; message: string } | { s: "ready"; e: NodeExplanation };

const Section = ({ title, children }: { title: string; children: React.ReactNode }) => (
  <section className="border-t border-app-border pt-3">
    <h3 className="font-lp-mono text-[10.5px] uppercase tracking-wide text-app-muted">{title}</h3>
    <div className="mt-1.5 space-y-1.5 font-lp-body text-[13px] text-app-charcoal">{children}</div>
  </section>
);

function ResourceRow({ r }: { r: Resource }) {
  const body = (
    <>
      <span className="font-medium">{r.title}</span>
      <span className="text-app-muted"> · {[r.provider, r.type?.toLowerCase(), r.hours ? `${r.hours}h` : null, r.cost, r.difficulty].filter(Boolean).join(" · ")}</span>
    </>
  );
  const external = r.url?.startsWith("https://");
  return (
    <li>
      {r.url ? (
        <a href={r.url} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="text-app-blue hover:underline">
          {body}
          {external && <span className="sr-only"> (opens in a new tab)</span>}
        </a>
      ) : (
        body
      )}
    </li>
  );
}

const TAG: Record<string, string> = { OFFICIAL: "bg-[#fde9a8]", ARTICLE: "bg-[#fde9a8]", VIDEO: "bg-[#e6d5fb]", COURSE: "bg-[#ffd166]", BOOK: "bg-[#e5e7eb]", PRACTICE: "bg-[#c8f0c8]" };
const TAG_LABEL: Record<string, string> = { OFFICIAL: "Official", ARTICLE: "Article", VIDEO: "Video", COURSE: "Course", BOOK: "Book", PRACTICE: "Practice" };

function Card({ title, tone, children }: { title: string; tone: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-app-border p-4">
      <h3 className={`font-lp-body text-[14px] font-semibold ${tone}`}>{title}</h3>
      <div className="mt-2.5 font-lp-body text-[14px] text-app-charcoal">{children}</div>
    </section>
  );
}

function TagList({ items }: { items: Resource[] }) {
  return (
    <ul className="space-y-2">
      {items.map((r) => {
        const external = r.url?.startsWith("https://");
        return (
          <li key={`${r.kind}${r.id}`} className="flex items-start gap-2">
            <span className={`mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[12px] ${TAG[r.type ?? "ARTICLE"]}`}>{TAG_LABEL[r.type ?? "ARTICLE"]}</span>
            {r.url ? <a href={r.url} {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})} className="underline underline-offset-2">{r.title}{external && <span className="sr-only"> (opens in a new tab)</span>}</a> : <span>{r.title}</span>}
            <span className="ml-auto shrink-0 text-[12px] text-app-muted">{[r.provider, r.hours ? `${r.hours}h` : null].filter(Boolean).join(" · ")}</span>
          </li>
        );
      })}
    </ul>
  );
}

const List = ({ items }: { items: Resource[] }) => <ul className="list-disc space-y-1 pl-4">{items.map((r) => <ResourceRow key={`${r.kind}${r.id}`} r={r} />)}</ul>;

export function TopicPanel({ nodeKey, career, careerId, onClose, onChanged, onSelect }: { nodeKey: string; career: "primary" | "plan-b"; careerId: string; onClose: () => void; onChanged: () => void; onSelect: (k: string) => void }) {
  const [load, setLoad] = useState<Load>({ s: "loading" });
  const tutor = useTutor(nodeKey, career);
  const [busy, setBusy] = useState(false);
  const [skipping, setSkipping] = useState(false);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);

  const [reload, setReload] = useState(0);

  useEffect(() => {
    let live = true;
    fetch(`/api/roadmap/explain?type=node&id=${encodeURIComponent(nodeKey)}&career=${career}`, { cache: "no-store" })
      .then(async (res) => ({ res, json: (await res.json()) as { payload?: NodeExplanation; error?: string } }))
      .then(({ res, json }) => live && setLoad(res.ok && json.payload ? { s: "ready", e: json.payload } : { s: "error", message: json.error ?? "Could not load this topic." }))
      .catch(() => live && setLoad({ s: "error", message: "Couldn't reach the server. Check your connection." }));
    return () => {
      live = false;
    };
  }, [nodeKey, career, reload]);

  const mark = async (status: "LEARNING" | "DONE" | "SKIPPED" | null, why?: string) => {
    setBusy(true);
    setError(null);
    const r = await send("PUT", "/api/roadmap/node-state", { nodeKey, careerId, status, ...(why ? { reason: why } : {}) });
    setBusy(false);
    if (!r.ok) return setError(r.error ?? "Could not save.");
    setSkipping(false);
    setReason("");
    onChanged();
    setReload((n) => n + 1);
  };

  const e = load.s === "ready" ? load.e : null;
  const topic = e?.type === "TOPIC";
  const seg = (active: boolean) => `px-3 py-1.5 font-lp-body text-[13px] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-app-blue ${active ? "bg-app-charcoal text-white" : "bg-white text-app-charcoal hover:bg-app-background"}`;
  return (
    <aside aria-label="Topic details" className="flex h-full flex-col overflow-hidden bg-white">
      <div className="flex items-center justify-between gap-2 border-b border-app-border px-5 py-3">
        <p className="font-lp-mono text-[10.5px] uppercase text-app-muted">{e ? (e.type === "TOPIC" ? "Topic" : e.type === "GROUP" ? "Section" : "Stage") : "Loading"}</p>
        <div className="flex items-center gap-2">
          {topic && e && (
            <div role="group" aria-label="Mark this topic" className="flex overflow-hidden rounded-md border border-app-border">
              <button type="button" disabled={busy} aria-pressed={e.userState === "LEARNING"} onClick={() => mark(e.userState === "LEARNING" ? null : "LEARNING")} className={seg(e.userState === "LEARNING")}>Learning</button>
              <button type="button" disabled={busy} aria-pressed={e.userState === "DONE"} onClick={() => mark(e.userState === "DONE" ? null : "DONE")} className={`${seg(e.userState === "DONE")} border-x border-app-border`}>Done</button>
              <button type="button" disabled={busy} aria-pressed={e.userState === "SKIPPED"} onClick={() => (e.userState === "SKIPPED" ? mark(null) : setSkipping(true))} className={seg(e.userState === "SKIPPED")}>Skip</button>
            </div>
          )}
          <button type="button" onClick={onClose} aria-label="Close details" className="rounded-md border border-app-border px-2.5 py-1.5 text-app-charcoal hover:bg-app-background focus-visible:outline-2 focus-visible:outline-app-blue">✕</button>
        </div>
      </div>

      {load.s === "loading" && <p role="status" className="p-5 font-lp-body text-[13px] text-app-muted">Loading…</p>}
      {load.s === "error" && (
        <div role="alert" className="p-5 font-lp-body text-[13px] text-app-rose">
          {load.message} <button type="button" onClick={() => { setLoad({ s: "loading" }); setReload((n) => n + 1); }} className="underline">Try again</button>
        </div>
      )}

      {e && (
        <>
          <div className="flex-1 space-y-4 overflow-y-auto px-5 py-5">
            <div>
              <h2 className="font-lp-display text-[34px] font-bold leading-[1.1] text-black">{e.title}</h2>
              <p className="mt-3 font-lp-body text-[15.5px] leading-relaxed text-app-charcoal">{e.description}</p>
            </div>
            {topic && <LearnCard tutor={tutor} />}
            {topic && <TutorAnswer tutor={tutor} />}
            <Body e={e} busy={busy} mark={mark} skipping={skipping} setSkipping={setSkipping} reason={reason} setReason={setReason} error={error} onSelect={onSelect} />
          </div>
          {topic && <AskBar tutor={tutor} title={e.title} />}
        </>
      )}
    </aside>
  );
}

function Body({ e, busy, mark, skipping, setSkipping, reason, setReason, error, onSelect }: { e: NodeExplanation; busy: boolean; mark: (s: "LEARNING" | "DONE" | "SKIPPED" | null, why?: string) => void; skipping: boolean; setSkipping: (b: boolean) => void; reason: string; setReason: (s: string) => void; error: string | null; onSelect: (k: string) => void }) {
  const meta = STATUS_META[e.status];
  const topic = e.type === "TOPIC";
  const btn = (active: boolean) => `rounded-md border px-3 py-1.5 font-lp-body text-[12.5px] disabled:opacity-50 focus-visible:outline-2 focus-visible:outline-app-blue ${active ? "border-app-charcoal bg-app-charcoal text-white" : "border-app-border bg-white text-app-charcoal hover:border-app-charcoal"}`;
  return (
    <>
      <p className="font-lp-body text-[12.5px] text-app-muted">{e.whyThisCareer}</p>
      {topic && (
        <div>
          <p className="mb-1.5"><span className={`inline-block rounded-full px-2 py-0.5 font-lp-mono text-[10.5px] uppercase ${meta.chip}`}><span aria-hidden>{meta.glyph} </span>{meta.label}</span></p>
          {e.userState && <p className="font-lp-body text-[11.5px] text-app-muted">Your mark never changes your verified score; it only tells your roadmap where you are.{e.skipReason ? ` Skipped because: ${e.skipReason}` : ""}</p>}
          {skipping && (
            <form onSubmit={(ev) => { ev.preventDefault(); void mark("SKIPPED", reason.trim()); }} className="mt-2 space-y-1.5">
              <label className="block font-lp-body text-[12.5px] text-app-charcoal" htmlFor="skip-reason">Why are you skipping this?</label>
              <input id="skip-reason" value={reason} onChange={(ev) => setReason(ev.target.value)} maxLength={300} minLength={3} required className="w-full rounded-md border border-app-border px-2.5 py-1.5 font-lp-body text-[13px]" />
              {e.skipWarnings.map((w) => <p key={w} role="note" className="font-lp-body text-[12px] text-app-warning">{w}</p>)}
              <button type="submit" disabled={busy || reason.trim().length < 3} className={btn(true)}>Skip this topic</button>
            </form>
          )}
          {error && <p role="alert" className="mt-1.5 font-lp-body text-[12px] text-app-rose">{error}</p>}
        </div>
      )}
      {e.needsCheck && <p role="note" className="rounded-md bg-app-warning-container px-3 py-2 font-lp-body text-[12.5px]">{e.needsCheck}</p>}

      {e.score && (
        <Section title="Why this score">
          <p>{e.score.summary}</p>
          {e.score.evidence.length > 0 && (
            <ul className="list-disc space-y-0.5 pl-4 text-[12.5px]">{e.score.evidence.map((l, i) => <li key={i}>{l.label} · {l.verified ? "verified" : "self-declared"}{l.observedAt ? ` · ${l.observedAt.slice(0, 10)}` : l.undated ? " · undated" : ""}: counts {l.contribution} (weight {l.weight})</li>)}</ul>
          )}
          <p className="text-[12px] text-app-muted">Target {e.score.target.level}: {e.score.target.source}.</p>
          <details className="text-[12px] text-app-muted"><summary className="cursor-pointer">How it&apos;s calculated</summary><p className="mt-1">{e.score.formula.text}</p></details>
        </Section>
      )}

      {e.rollup && (
        <Section title="How this number is built">
          <p className="text-[12px] text-app-muted">{e.rollup.formula}</p>
          <ul className="space-y-0.5 text-[12.5px]">
            {e.rollup.leaves.map((l) => (
              <li key={l.key}><button type="button" onClick={() => onSelect(l.key)} className="text-app-blue hover:underline">{l.title}</button> · {l.level === null ? "not assessed" : `${l.level}`}/{l.target}</li>
            ))}
          </ul>
        </Section>
      )}

      {topic && (
        <Section title="In your college">
          <p><strong>{COVERAGE_LABEL[e.college.state]}</strong>{e.college.basis === "INFERRED" ? " (Capabilio's reading of the syllabus, not confirmed by your college)" : e.college.basis === "MIXED" ? " (partly confirmed by your college)" : ""}</p>
          {e.college.message && <p className="text-app-muted">{e.college.message}</p>}
          {e.college.state === "UNKNOWN" && !e.college.message && <p className="text-app-muted">Your syllabus hasn&apos;t been analysed enough to say.</p>}
          <ul className="space-y-2">
            {e.college.items.map((c) => (
              <li key={c.courseId} className="rounded-md bg-app-background p-2.5 text-[12.5px]">
                <p className="font-medium">{c.title}{c.code ? ` (${c.code})` : ""}</p>
                <p className="text-app-muted">Year {c.year}{c.semester ? ` · Semester ${(c.year - 1) * 2 + c.semester}` : ""} · {({ COMPLETED: "completed", CURRENT: "this semester", UPCOMING: "upcoming", UNKNOWN: "" } as const)[c.timing]}{c.pages ? ` · syllabus p. ${c.pages.start}${c.pages.end !== c.pages.start ? `–${c.pages.end}` : ""}` : ""} · {c.tier === "OFFICIAL" ? "confirmed by your college" : "inferred by Capabilio"}</p>
                {c.units.map((u) => <p key={u.no}>Unit {u.no}: {u.title}</p>)}
                {c.outcomes.map((o) => <p key={o.code}>{o.code}: {o.text} <span className="text-app-muted">({o.source === "EXTRACTED" ? "printed in the syllabus" : o.source === "INFERRED" ? "derived by Capabilio" : "confirmed by your college"})</span></p>)}
                {c.evidence && <p className="italic text-app-muted">“{c.evidence}”</p>}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {(e.prerequisites.length > 0 || e.unlocks.length > 0) && (
        <Section title="Order">
          {e.prerequisites.length > 0 && <p>Before this: {e.prerequisites.map((p, i) => <span key={p.key}>{i ? ", " : ""}<button type="button" onClick={() => onSelect(p.key)} className="text-app-blue hover:underline">{p.title}</button></span>)}</p>}
          {e.unlocks.length > 0 && <p>This unlocks: {e.unlocks.map((p, i) => <span key={p.key}>{i ? ", " : ""}<button type="button" onClick={() => onSelect(p.key)} className="text-app-blue hover:underline">{p.title}</button></span>)}</p>}
        </Section>
      )}

      {topic && e.resources.premium.length > 0 && <Card title="★ Premium Resources" tone="text-purple-700"><TagList items={e.resources.premium} /></Card>}
      {topic && (
        <Card title="♥ Free Resources" tone="text-green-700">
          {e.resources.free.length > 0 ? <TagList items={e.resources.free} /> : <p className="text-app-muted">No learning resources are listed for this topic yet.</p>}
        </Card>
      )}

      {topic && (e.practice.arena.length + e.practice.projects.length + e.practice.certifications.length > 0 || e.whatIf.length > 0) && (
        <Section title="Practice and proof">
          {e.practice.arena.length > 0 && <><p className="font-medium">Arena challenges</p><List items={e.practice.arena} /></>}
          {e.whatIf.map((w) => <p key={w.resourceId} className="text-[12px] text-app-muted">If you pass “{w.title}”, this level would rise from {w.from ?? "not assessed"} to about {w.to}.</p>)}
          {e.practice.projects.length > 0 && <><p className="font-medium">Projects</p><List items={e.practice.projects} /></>}
          {e.practice.certifications.length > 0 && <><p className="font-medium">Certifications</p><List items={e.practice.certifications} /></>}
        </Section>
      )}
    </>
  );
}
