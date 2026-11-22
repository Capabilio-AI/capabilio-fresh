import Link from "next/link";
import { ArrowUpRight, Clock, ShieldCheck, TriangleAlert } from "lucide-react";
import type { PathwayRow } from "@/lib/pathways/store";
import { freshness, renderProse, type Freshness } from "@/lib/pathways/rules";
import type { FactSpec } from "@/lib/pathways/schema";

const FRESH_TEXT: Record<Freshness, string> = { fresh: "Checked recently", due: "Due for a re-check", stale: "Out of date: check the official site" };
const KIND_TEXT: Record<string, string> = { exam: "Exam route", portfolio: "Portfolio route", credential: "Credential route", venture: "Own venture" };
const ROUTE_TEXT: Record<string, string> = { exam: "Exam", degree: "Degree", entrance: "Entrance test", portfolio: "Portfolio", apprenticeship: "Apprenticeship", direct: "Direct entry" };
const dateText = (iso: string) => new Date(`${iso}T00:00:00Z`).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "UTC" });

/** A published pathway, in the order a student needs it. Every changing fact is shown with where it came from and how old the check is. */
export function PathwayView({ pathway, now = new Date() }: { pathway: PathwayRow; now?: Date }) {
  const { spec } = pathway;
  const facts = new Map<string, FactSpec>(spec.facts.map((f) => [f.key, f]));
  const prose = (t: string) => renderProse(t, facts).text;
  const stale = spec.facts.filter((f) => freshness(f, now) === "stale");
  const card = "rounded-2xl border border-[var(--m-rule)] bg-white p-5";
  const h2 = "font-lp-display text-[24px] font-bold leading-tight text-[var(--m-ink)]";

  return (
    <article className="flex flex-col gap-8 pb-16">
      <header>
        <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--m-accent-ink)]">{KIND_TEXT[spec.kind]}{pathway.provenance === "ai_drafted" && " · AI-drafted, reviewed by Capabilio"}</p>
        <h1 className="mt-1 font-lp-display text-[34px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[46px]">{spec.name}</h1>
        <p className="mt-3 max-w-[68ch] whitespace-pre-wrap text-[16px] leading-relaxed text-[var(--m-ink)]">{prose(spec.summary)}</p>
      </header>

      {stale.length > 0 && (
        <p role="alert" className="flex items-start gap-2 rounded-xl border border-[#b45309]/40 bg-[#fffbeb] p-4 text-[14px] text-[#78350f]"><TriangleAlert size={18} aria-hidden className="mt-0.5 shrink-0" />Some facts on this page have not been re-checked in a while: {stale.map((f) => f.label).join(", ")}. Confirm them on the official site before you act on them.</p>
      )}

      <section aria-labelledby="routes-h">
        <h2 id="routes-h" className={h2}>Ways in</h2>
        <ul className="mt-4 grid gap-4 md:grid-cols-2">
          {spec.routes.map((r) => (
            <li key={r.key} className={card}>
              <p className="text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{ROUTE_TEXT[r.kind]}</p>
              <h3 className="mt-1 text-[18px] font-bold text-[var(--m-ink)]">{r.title}</h3>
              <p className="mt-2 whitespace-pre-wrap text-[14.5px] leading-relaxed text-[var(--m-ink)]">{prose(r.body)}</p>
              {r.eligibilityFacts.length > 0 && (
                <dl className="mt-3 flex flex-col gap-1.5 text-[14px]">
                  {r.eligibilityFacts.map((k) => facts.get(k)).filter((f): f is FactSpec => Boolean(f)).map((f) => (
                    <div key={f.key}><dt className="text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{f.label}</dt><dd className="text-[var(--m-ink)]">{f.value}</dd></div>
                  ))}
                </dl>
              )}
              <a href={r.officialUrl} target="_blank" rel="noopener noreferrer" className="mt-3 inline-flex items-center gap-1 text-[14px] font-bold text-[var(--m-accent-ink)]">{r.officialBody}<ArrowUpRight size={14} aria-hidden /></a>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="start-h">
        <h2 id="start-h" className={h2}>Start this week</h2>
        <ol className="mt-4 flex flex-col gap-3">
          {[...spec.startThisWeek].sort((a, b) => a.day - b.day).map((d) => (
            <li key={d.day} className={`${card} flex gap-4`}><span className="ss-num text-[22px] font-bold text-[var(--m-accent-ink)]" aria-label={`Day ${d.day}`}>{d.day}</span><div><h3 className="text-[16px] font-bold text-[var(--m-ink)]">{d.title}</h3><p className="mt-1 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{prose(d.body)}</p></div></li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="stages-h">
        <h2 id="stages-h" className={h2}>The path, stage by stage</h2>
        <ol className="mt-4 flex flex-col gap-5">
          {spec.stages.map((s, i) => (
            <li key={s.key} className={card}>
              <h3 className="text-[18px] font-bold text-[var(--m-ink)]"><span className="ss-num mr-2 text-[var(--m-accent-ink)]">{i + 1}</span>{s.title}</h3>
              <ul className="mt-3 flex flex-col gap-3">
                {s.steps.map((st, j) => (
                  <li key={j}>
                    <p className="text-[15px] font-bold text-[var(--m-ink)]">{st.title}</p>
                    <p className="mt-0.5 whitespace-pre-wrap text-[14.5px] leading-relaxed text-[var(--m-ink)]">{prose(st.body)}</p>
                    {st.resources.length > 0 && <ul className="mt-1 flex flex-wrap gap-x-4 gap-y-1">{st.resources.map((r) => <li key={r.url}><a href={r.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[13.5px] font-bold text-[var(--m-accent-ink)]">{r.title}<ArrowUpRight size={12} aria-hidden /></a></li>)}</ul>}
                  </li>
                ))}
              </ul>
            </li>
          ))}
        </ol>
      </section>

      <section aria-labelledby="watch-h">
        <h2 id="watch-h" className={h2}>Where to watch for notifications</h2>
        <ul className="mt-4 flex flex-col gap-3">
          {spec.watch.map((w) => (
            <li key={w.url} className={card}><a href={w.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 text-[16px] font-bold text-[var(--m-accent-ink)]">{w.title}<ArrowUpRight size={14} aria-hidden /></a><p className="mt-1 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{prose(w.how)}</p></li>
          ))}
        </ul>
      </section>

      {spec.alternatives.length > 0 && (
        <section aria-labelledby="alt-h">
          <h2 id="alt-h" className={h2}>If this route does not work out</h2>
          <ul className="mt-3 list-disc pl-5 text-[15px] leading-relaxed text-[var(--m-ink)]">{spec.alternatives.map((a, i) => <li key={i}>{prose(a)}</li>)}</ul>
        </section>
      )}

      <section aria-labelledby="honest-h" className={card}>
        <h2 id="honest-h" className="flex items-center gap-2 text-[18px] font-bold text-[var(--m-ink)]"><ShieldCheck size={18} aria-hidden />What Capabilio can and cannot verify</h2>
        <ul className="mt-2 list-disc pl-5 text-[14.5px] leading-relaxed text-[var(--m-ink)]">{spec.honesty.map((h, i) => <li key={i}>{prose(h)}</li>)}</ul>
      </section>

      {spec.facts.length > 0 && (
        <section aria-labelledby="src-h">
          <h2 id="src-h" className={h2}>Sources for the facts above</h2>
          <ul className="mt-4 flex flex-col gap-2">
            {spec.facts.map((f) => {
              const fr = freshness(f, now);
              return (
                <li key={f.key} className="rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3 text-[14px]">
                  <p className="font-bold text-[var(--m-ink)]">{f.label}: <span className="font-normal">{f.value}</span></p>
                  <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[13px] text-[var(--m-muted)]"><a href={f.sourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 font-bold text-[var(--m-accent-ink)]">Official source<ArrowUpRight size={12} aria-hidden /></a><span className="inline-flex items-center gap-1"><Clock size={12} aria-hidden />Read on {dateText(f.retrievedAt)} · {FRESH_TEXT[fr]}</span></p>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <Link href="/pathways" className="text-[14px] font-bold text-[var(--m-accent-ink)]">All pathways</Link>
    </article>
  );
}
