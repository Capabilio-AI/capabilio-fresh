"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Building2, CheckCircle2, ChevronRight, ExternalLink, Search, X } from "lucide-react";
import { NEGATIVE_MARK } from "@/lib/crt/marking";
import { ROUND_LABEL, SECTORS } from "@/lib/crt/companies";
import type { CompanyView, RoundView } from "@/lib/crt/company-server";
import { CompanyExam } from "./SimulatorExam";
import { useLoad } from "./use-load";

const CARD = "rounded-2xl border border-app-border bg-white p-5 sm:p-6";
/** companies shown before "Show more", so the page stays short however many are published */
const PAGE = 8;
const initials = (name: string) => name.split(/\s+/).slice(0, 2).map((w) => w[0]?.toUpperCase() ?? "").join("");
const checkedOn = (iso: string | null) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "");

/** Where to practise a round that is not a multiple-choice paper. */
const PRACTICE_LINK: Partial<Record<RoundView["kind"], { href: string; label: string }>> = {
  technical_interview: { href: "/dashboard/interview", label: "Practise with a mock interview" },
  hr_interview: { href: "/dashboard/interview", label: "Practise with a mock interview" },
  coding: { href: "/skillstudio/languages", label: "Practise coding in SkillStudio" },
};

function meta(r: RoundView): string {
  const parts = [r.minutes ? `${r.minutes} min` : null, r.questions ? `${r.questions} questions` : null, r.sections.length > 1 ? `${r.sections.length} sections` : null, `−${r.negativeMarking || NEGATIVE_MARK} per wrong answer`];
  return parts.filter(Boolean).join(" · ");
}

function Round({ r, onStart }: { r: RoundView; onStart: (id: string) => void }) {
  const practice = PRACTICE_LINK[r.kind];
  return (
    <li className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-app-border p-4">
      <div className="min-w-0">
        <p className="font-lp-body text-[11.5px] font-bold uppercase tracking-wide text-app-muted">Round {r.position} · {ROUND_LABEL[r.kind]}</p>
        <p className="mt-0.5 font-lp-display text-[17px] font-bold text-app-charcoal">{r.title}</p>
        {meta(r) && <p className="mt-0.5 font-lp-body text-[13px] text-app-muted">{meta(r)}</p>}
        {r.notes && <p className="mt-1 max-w-[60ch] font-lp-body text-[13px] text-app-charcoal">{r.notes}</p>}
      </div>
      <div className="flex items-center gap-3">
        {r.status === "completed" && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ec] px-3 py-1 font-lp-body text-[12.5px] font-bold text-[#17784a]"><CheckCircle2 size={14} aria-hidden />Best {r.bestPct}%{r.attempts > 1 ? ` · ${r.attempts} tries` : ""}</span>}
        {r.mockable ? (
          <button type="button" onClick={() => onStart(r.id)} className="rounded-xl bg-[var(--m-ink)] px-4 py-2.5 font-lp-body text-[13.5px] font-semibold text-white">{r.status === "completed" ? "Try again" : "Start mock"}</button>
        ) : practice ? (
          <Link href={practice.href} className="inline-flex items-center gap-1 font-lp-body text-[13.5px] font-semibold text-[var(--m-ink)] underline">{practice.label}<ChevronRight size={14} aria-hidden /></Link>
        ) : (
          <span className="font-lp-body text-[12.5px] text-app-muted">Read the notes to prepare</span>
        )}
      </div>
    </li>
  );
}

function Detail({ c, onStart }: { c: CompanyView; onStart: (id: string) => void }) {
  return (
    <div>
      {c.about && <p className="max-w-[70ch] font-lp-body text-[14px] leading-relaxed text-app-charcoal">{c.about}</p>}
      {c.process.length > 0 && (
        <div className="mt-4">
          <h3 className="font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">How they hire</h3>
          <ol className="mt-2 flex list-decimal flex-col gap-1 pl-5 font-lp-body text-[14px] text-app-charcoal">{c.process.map((p) => <li key={p}>{p}</li>)}</ol>
        </div>
      )}
      <h3 className="mt-5 font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted">Rounds</h3>
      <ul className="mt-2 flex flex-col gap-3">{c.rounds.map((r) => <Round key={r.id} r={r} onStart={onStart} />)}</ul>
      <p className="mt-4 max-w-[70ch] font-lp-body text-[12.5px] leading-relaxed text-app-muted">
        These are Capabilio practice papers written in {c.name}&apos;s pattern, not {c.name}&apos;s own questions. {c.patternSourceUrl && <>Pattern from <a href={c.patternSourceUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold underline">its source<ExternalLink size={11} aria-hidden /></a>, checked {checkedOn(c.patternCheckedOn)}. </>}Companies change their tests, so confirm against the latest notice{c.officialUrl && <> on <a href={c.officialUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-0.5 font-semibold underline">their careers page<ExternalLink size={11} aria-hidden /></a></>}.
      </p>
    </div>
  );
}

/** One company's process and rounds in a dialog, so opening it never lengthens the CRT page. Escape or the backdrop closes it. */
function CompanyDialog({ c, onStart, onClose }: { c: CompanyView; onStart: (id: string) => void; onClose: () => void }) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 p-0 sm:items-center sm:p-6" onClick={onClose}>
      <div role="dialog" aria-modal="true" aria-label={c.name} onClick={(e) => e.stopPropagation()} className="flex max-h-[90vh] w-full max-w-2xl flex-col overflow-hidden rounded-t-2xl bg-white shadow-xl sm:rounded-2xl">
        <header className="flex items-center gap-3 border-b border-app-border px-5 py-4">
          <span aria-hidden className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[var(--m-ink)] font-lp-display text-[15px] font-bold text-white">{initials(c.name) || <Building2 size={18} />}</span>
          <div className="min-w-0 flex-1">
            <h3 className="truncate font-lp-display text-[19px] font-bold text-app-charcoal">{c.name}</h3>
            <p className="font-lp-body text-[12.5px] text-app-muted">{c.sector} · {c.rounds.length} {c.rounds.length === 1 ? "round" : "rounds"}</p>
          </div>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-2 text-app-muted hover:bg-[var(--m-ground)]"><X size={18} aria-hidden /></button>
        </header>
        <div className="overflow-y-auto px-5 py-5"><Detail c={c} onStart={onStart} /></div>
      </div>
    </div>
  );
}

/** "Prepare by company": each company's hiring process and rounds, with timed mocks in its pattern, taken in the locked exam screen. */
export function CompanyHub() {
  const [nonce, setNonce] = useState(0);
  const { data, error } = useLoad<{ companies: CompanyView[] }>({ action: "companies", nonce });
  const [query, setQuery] = useState("");
  const [sector, setSector] = useState<string>("All");
  const [openSlug, setOpenSlug] = useState<string | null>(null);
  const [round, setRound] = useState<string | null>(null);
  const [limit, setLimit] = useState(PAGE);

  const companies = useMemo(() => data?.companies ?? [], [data]);
  const sectors = useMemo(() => ["All", ...SECTORS.filter((s) => companies.some((c) => c.sector === s))], [companies]);
  const shown = companies.filter((c) => (sector === "All" || c.sector === sector) && c.name.toLowerCase().includes(query.trim().toLowerCase()));
  const open = companies.find((c) => c.slug === openSlug) ?? null;

  return (
    <section className={CARD} aria-label="Prepare by company">
      <h2 className="font-lp-display text-[20px] font-bold text-app-charcoal">Prepare by company</h2>
      <p className="mt-1 max-w-[62ch] font-lp-body text-[14px] text-app-muted">See how a company hires, then take a timed mock in its pattern: its sections, its time and its negative marking.</p>

      {error && <p role="alert" className="mt-4 font-lp-body text-[13px] text-app-warning">{error}</p>}
      {!data && !error && <p className="mt-4 font-lp-body text-[13.5px] text-app-muted">Loading companies…</p>}
      {data && companies.length === 0 && (
        <p className="mt-4 rounded-xl bg-[var(--m-ground)] p-4 font-lp-body text-[13.5px] text-app-charcoal">Company papers are on their way. Each company appears here only after its test pattern has been added with its source and checked, so you are never practising against a guess.</p>
      )}

      {companies.length > 0 && (
        <>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="relative min-w-[220px] flex-1">
              <span className="sr-only">Search companies</span>
              <Search size={16} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
              <input value={query} onChange={(e) => { setQuery(e.target.value); setLimit(PAGE); }} placeholder="Search companies" className="w-full rounded-xl border border-app-border bg-white py-2.5 pl-9 pr-3 font-lp-body text-[14px] text-app-charcoal outline-none focus:border-[var(--m-ink)]" />
            </label>
            <div role="group" aria-label="Sector" className="flex max-w-full gap-2 overflow-x-auto pb-1">
              {sectors.map((s) => <button key={s} type="button" aria-pressed={sector === s} onClick={() => { setSector(s); setLimit(PAGE); }} className={`shrink-0 whitespace-nowrap rounded-full border px-3.5 py-1.5 font-lp-body text-[13px] font-semibold ${sector === s ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-app-border bg-white text-app-charcoal hover:bg-[var(--m-ground)]"}`}>{s}</button>)}
            </div>
          </div>

          <ul className="mt-4 grid gap-2.5 sm:grid-cols-2 lg:grid-cols-4">
            {shown.slice(0, limit).map((c) => {
              const done = c.rounds.filter((r) => r.status === "completed").length;
              return (
                <li key={c.id}>
                  <button type="button" aria-haspopup="dialog" onClick={() => setOpenSlug(c.slug)} className="flex w-full items-center gap-2.5 rounded-xl border border-app-border p-3 text-left hover:bg-[var(--m-ground)]">
                    <span aria-hidden className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--m-ink)] font-lp-display text-[13px] font-bold text-white">{initials(c.name) || <Building2 size={16} />}</span>
                    <span className="min-w-0 flex-1"><span className="block truncate font-lp-body text-[14px] font-bold text-app-charcoal">{c.name}</span><span className="block truncate font-lp-body text-[12px] text-app-muted">{c.sector} · {c.rounds.length} {c.rounds.length === 1 ? "round" : "rounds"}{done ? ` · ${done} done` : ""}</span></span>
                    <ChevronRight size={15} aria-hidden className="shrink-0 text-app-muted" />
                  </button>
                </li>
              );
            })}
            {shown.length === 0 && <li className="font-lp-body text-[13.5px] text-app-muted">No company matches that search.</li>}
          </ul>
          {shown.length > PAGE && (
            <div className="mt-3 flex items-center justify-between gap-3 font-lp-body text-[13px] text-app-muted">
              <span>Showing {Math.min(limit, shown.length)} of {shown.length}</span>
              {limit < shown.length ? <button type="button" onClick={() => setLimit((n) => n + PAGE)} className="rounded-full border border-app-border px-4 py-1.5 font-semibold text-app-charcoal hover:bg-[var(--m-ground)]">Show more</button> : <button type="button" onClick={() => setLimit(PAGE)} className="font-semibold text-app-charcoal underline">Show fewer</button>}
            </div>
          )}
          {open && <CompanyDialog c={open} onStart={setRound} onClose={() => setOpenSlug(null)} />}
        </>
      )}
      {round && <CompanyExam roundId={round} onClose={() => { setRound(null); setNonce((n) => n + 1); }} />}
    </section>
  );
}
