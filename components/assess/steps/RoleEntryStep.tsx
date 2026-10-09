"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { ArrowRight, BarChart3, Check, ClipboardCheck, Compass, GitFork, RotateCcw, Search, Sparkles } from "lucide-react";
import type { ResolveOutcome, RoleCandidate, RoleOption } from "@/lib/assess/roles";
import { filterRoles } from "@/lib/assess/role-filter";
import { ApiError, NetworkError, assessApi } from "../api";
import { Button } from "../ui/Button";

const EXAMPLES = ["data analyst", "generative AI engineer", "game developer", "devops", "product manager", "data engineer"];
const SHOWN = 6;
const LISTBOX = "role-suggestions";
const IMPORTANCE_ORDER = ["CRITICAL", "HIGH", "MEDIUM", "LOW"] as const;
const IMPORTANCE_LABEL: Record<(typeof IMPORTANCE_ORDER)[number], string> = { CRITICAL: "Core", HIGH: "Important", MEDIUM: "Supporting", LOW: "Good to have" };

const NEXT = [
  { icon: ClipboardCheck, title: "A basic skill test", body: "A short assessment shows where you stand on the skills this role needs." },
  { icon: BarChart3, title: "Your skill graph", body: "We analyse your results and build it. It keeps updating as you complete role challenges in Capabilio." },
  { icon: GitFork, title: "Plan B, in 3rd year", body: "We'll ask whether you want to continue with this role or switch to another." },
];

type View =
  | { kind: "input" }
  | { kind: "resolving"; text: string }
  | { kind: "review"; primary: RoleCandidate; alternatives: RoleCandidate[]; fresh: boolean }
  | { kind: "rejected"; message: string }
  | { kind: "error"; message: string };

/**
 * Step 1. The role list ships with the page and filters locally, so picking a known role is instant (no request per keystroke, no
 * wait to see its skills). Only a role we have never seen goes to the server, which builds its profile once for everyone after.
 * Doing this FIRST lets the server warm the role's question pool while the student does the common assessment.
 */
export function RoleEntryStep({ roles, onConfirmed }: { roles: RoleOption[]; onConfirmed: () => void }) {
  const reduce = useReducedMotion();
  const [text, setText] = useState("");
  const [view, setView] = useState<View>({ kind: "input" });
  const [confirming, setConfirming] = useState(false);
  const [example, setExample] = useState(0);
  const [showAll, setShowAll] = useState(false);
  const [active, setActive] = useState(-1);
  const input = useRef<HTMLInputElement>(null);

  const typed = text.trim();
  const hits = useMemo(() => filterRoles(roles, text), [roles, text]);
  const visible = typed || showAll ? hits.slice(0, typed ? 8 : hits.length) : hits.slice(0, SHOWN);
  const asTyped = typed.length >= 2 && !hits.some((h) => h.role.name.toLowerCase() === typed.toLowerCase());
  const rows = visible.length + (asTyped ? 1 : 0);

  useEffect(() => {
    if (reduce || view.kind !== "input") return;
    const t = setInterval(() => setExample((e) => (e + 1) % EXAMPLES.length), 2800);
    return () => clearInterval(t);
  }, [reduce, view.kind]);

  /** A role from the list: its skills are already here, so the review opens with no request at all. */
  const choose = (role: RoleOption) => {
    setView({ kind: "review", primary: role, alternatives: hits.filter((h) => h.role.careerId !== role.careerId).slice(0, 3).map((h) => h.role), fresh: false });
  };
  /** Free text: the server matches it to a role or builds a profile for a new one. */
  const resolveTyped = async (value = typed) => {
    const q = value.trim();
    if (q.length < 2) return input.current?.focus();
    setView({ kind: "resolving", text: q });
    try {
      const out: ResolveOutcome = await assessApi.resolveRole(q);
      setView(out.status === "REJECTED" ? { kind: "rejected", message: out.message } : { kind: "review", primary: out.primary, alternatives: out.alternatives, fresh: out.status === "GENERATED" });
    } catch (e) {
      setView({ kind: "error", message: e instanceof NetworkError ? "We couldn't reach the server. Check your connection and try again." : e instanceof ApiError ? e.message : "Something went wrong. Please try again." });
    }
  };
  const pick = (i: number) => (i < visible.length ? choose(visible[i].role) : void resolveTyped());

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") { e.preventDefault(); setActive((a) => (rows ? (a + 1) % rows : -1)); }
    else if (e.key === "ArrowUp") { e.preventDefault(); setActive((a) => (rows ? (a <= 0 ? rows - 1 : a - 1) : -1)); }
    else if (e.key === "Enter") { e.preventDefault(); if (active >= 0) pick(active); else if (visible.length === 1 || (hits[0] && typed && hits[0].role.name.toLowerCase() === typed.toLowerCase())) choose(hits[0].role); else void resolveTyped(); }
    else if (e.key === "Escape") setActive(-1);
  };

  const confirm = async (careerId: string) => {
    setConfirming(true);
    try {
      await assessApi.confirmRole(careerId);
      onConfirmed();
    } catch (e) {
      setConfirming(false);
      setView({ kind: "error", message: e instanceof ApiError ? e.message : "We couldn't save that. Please try again." });
    }
  };

  if (view.kind === "review") {
    return <Review view={view} confirming={confirming} onPick={(c) => setView({ ...view, primary: c, alternatives: [view.primary, ...view.alternatives.filter((a) => a.careerId !== c.careerId)], fresh: false })} onConfirm={() => confirm(view.primary.careerId)} onRetry={() => setView({ kind: "input" })} />;
  }

  const busy = view.kind === "resolving";
  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:pt-12" aria-labelledby="role-title">
      <div className="a-rise text-center">
        <span className="a-glass-soft mx-auto inline-flex items-center gap-2 rounded-full px-3.5 py-1.5 text-[13px] font-bold text-[var(--m-ink)]"><Compass className="h-4 w-4 text-[var(--m-accent)]" aria-hidden /> Start with your goal</span>
        <h1 id="role-title" className="mx-auto mt-5 max-w-2xl text-balance font-lp-display text-[40px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[56px]">Which role are you building toward?</h1>
        <p className="mx-auto mt-4 max-w-xl text-pretty text-[16px] leading-relaxed text-[var(--m-muted)]">Pick your target role. Capabilio tests your basic skills for it, then builds your skill graph.</p>
      </div>

      <form className="a-rise mt-8" style={{ animationDelay: "100ms" }} onSubmit={(e) => { e.preventDefault(); }} aria-busy={busy}>
        <label htmlFor="role" className="sr-only">Your target role</label>
        <div className="a-glass relative flex items-center gap-2 rounded-full p-2 pl-5 transition-shadow duration-300 focus-within:shadow-[0_0_0_3px_var(--m-accent-ink),0_28px_56px_-28px_rgb(23_19_31/0.38)]">
          <Search className="h-5 w-5 shrink-0 text-[var(--m-off)]" aria-hidden />
          <div className="relative min-w-0 flex-1">
            <input ref={input} id="role" value={text} onChange={(e) => { setText(e.target.value); setActive(-1); }} onKeyDown={onKeyDown} maxLength={160} autoComplete="off" autoFocus disabled={busy}
              role="combobox" aria-expanded={rows > 0} aria-controls={LISTBOX} aria-autocomplete="list" aria-activedescendant={active >= 0 ? `${LISTBOX}-${active}` : undefined}
              style={{ outline: "none" }} className="w-full bg-transparent py-3 text-[17px] font-bold text-[var(--m-ink)]" />
            {!text && <span aria-hidden className="pointer-events-none absolute inset-y-0 left-0 flex items-center text-[17px] text-[var(--m-off)]">Search or type a role, e.g. {EXAMPLES[reduce ? 0 : example]}</span>}
          </div>
          <Button type="button" variant="accent" size="lg" loading={busy} onClick={() => (hits[0] && typed && hits[0].role.name.toLowerCase() === typed.toLowerCase() ? choose(hits[0].role) : void resolveTyped())} iconAfter={<ArrowRight className="h-4 w-4" aria-hidden />}>{busy ? "Matching" : "Find my role"}</Button>
        </div>
      </form>

      {busy && <Resolving text={(view as { text: string }).text} />}
      {(view.kind === "rejected" || view.kind === "error") && (
        <div role="alert" className="a-glass a-rise mx-auto mt-6 max-w-xl rounded-2xl p-5 text-center"><p className="text-[15px] font-bold text-[var(--m-ink)]">{view.message}</p></div>
      )}

      {!busy && (
        <div className="mx-auto mt-5 w-full max-w-[44rem]">
          <p className="mb-2 px-2 text-[12.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">{typed ? "Matching roles" : "Popular roles"}</p>
          <ul id={LISTBOX} role="listbox" aria-label="Roles" className="a-glass-soft overflow-hidden rounded-3xl p-1.5">
            {visible.map(({ role, matched }, i) => (
              <li key={role.careerId} id={`${LISTBOX}-${i}`} role="option" aria-selected={active === i}>
                <button type="button" tabIndex={-1} onMouseEnter={() => setActive(i)} onClick={() => choose(role)} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 ${active === i ? "bg-white" : "hover:bg-white/70"}`}>
                  <span className="text-[16px] font-bold text-[var(--m-ink)]">{highlight(role.name, typed)}</span>
                  <span className="flex items-center gap-2 text-[13px] text-[var(--m-muted)]">{matched && <span>matches “{matched}”</span>}<ArrowRight className="h-4 w-4 opacity-60" aria-hidden /></span>
                </button>
              </li>
            ))}
            {asTyped && (
              <li id={`${LISTBOX}-${visible.length}`} role="option" aria-selected={active === visible.length}>
                <button type="button" tabIndex={-1} onMouseEnter={() => setActive(visible.length)} onClick={() => void resolveTyped()} className={`flex w-full items-center justify-between gap-3 rounded-2xl px-4 py-3 text-left transition-colors duration-150 ${active === visible.length ? "bg-white" : "hover:bg-white/70"}`}>
                  <span className="text-[16px] text-[var(--m-ink)]">Use <span className="font-bold">“{typed}”</span> as my role</span>
                  <span className="flex items-center gap-1.5 text-[13px] text-[var(--m-muted)]"><Sparkles className="h-3.5 w-3.5" aria-hidden /> we&apos;ll build its profile</span>
                </button>
              </li>
            )}
          </ul>
          {!typed && !showAll && hits.length > SHOWN && (
            <button type="button" onClick={() => setShowAll(true)} className="mx-auto mt-3 block rounded-full px-4 py-2 text-[14px] font-bold text-[var(--m-muted)] transition-colors hover:bg-white/60 hover:text-[var(--m-ink)]">Show all {hits.length} roles</button>
          )}
        </div>
      )}

      <ol className="a-rise mt-10 grid gap-3 sm:grid-cols-3" style={{ animationDelay: "200ms" }} aria-label="What happens next">
        {NEXT.map((n) => (
          <li key={n.title} className="flex gap-3 px-1">
            <span className="a-glass-soft flex h-9 w-9 shrink-0 items-center justify-center rounded-xl text-[var(--m-accent-ink)]"><n.icon className="h-4 w-4" aria-hidden /></span>
            <span><span className="block text-[14px] font-bold text-[var(--m-ink)]">{n.title}</span><span className="block text-[13px] leading-snug text-[var(--m-muted)]">{n.body}</span></span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** Bolds the part of a role name the student has typed. */
function highlight(name: string, typed: string) {
  const i = typed ? name.toLowerCase().indexOf(typed.toLowerCase()) : -1;
  if (i < 0) return name;
  return <>{name.slice(0, i)}<mark className="rounded bg-[var(--m-accent-soft)] px-0.5 text-[var(--m-accent-ink)]">{name.slice(i, i + typed.length)}</mark>{name.slice(i + typed.length)}</>;
}

function Resolving({ text }: { text: string }) {
  const [slow, setSlow] = useState(false);
  useEffect(() => {
    const t = setTimeout(() => setSlow(true), 2500);
    return () => clearTimeout(t);
  }, []);
  return (
    <div role="status" aria-live="polite" className="a-glass mx-auto mt-6 max-w-xl rounded-2xl p-5 a-rise">
      <p className="text-[14.5px] font-bold text-[var(--m-ink)]">{slow ? `Building a skill profile for “${text}”. New roles take a few seconds.` : "Matching your words to a role…"}</p>
      <div className="mt-4 flex flex-wrap gap-2" aria-hidden>
        {[88, 64, 104, 72, 96, 58, 80].map((w, i) => <span key={i} className="a-skeleton h-8 rounded-full" style={{ width: w }} />)}
      </div>
    </div>
  );
}

function Review({ view, confirming, onPick, onConfirm, onRetry }: { view: Extract<View, { kind: "review" }>; confirming: boolean; onPick: (c: RoleCandidate) => void; onConfirm: () => void; onRetry: () => void }) {
  const { primary, alternatives, fresh } = view;
  const groups = IMPORTANCE_ORDER.map((imp) => ({ imp, skills: primary.skills.filter((s) => s.importance === imp) })).filter((g) => g.skills.length > 0);
  return (
    <section className="mx-auto w-full max-w-4xl px-4 pb-16 pt-6 sm:pt-10" aria-labelledby="review-title">
      <motion.div initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="a-glass rounded-[2rem] p-6 sm:p-10">
        <p className="flex items-center gap-2 text-[13px] font-bold text-[var(--m-muted)]">
          We&apos;ll assess you as
          {fresh && <span className="inline-flex items-center gap-1 rounded-full bg-[var(--m-accent-soft)] px-2.5 py-0.5 text-[11.5px] font-bold text-[var(--m-accent-ink)]"><Sparkles className="h-3 w-3" aria-hidden /> New profile built for you</span>}
        </p>
        <h1 id="review-title" className="mt-1 text-balance font-lp-display text-[40px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[56px]">{primary.name}</h1>
        <p className="mt-3 text-[15px] text-[var(--m-muted)]">{primary.skills.length} skills across this role. Your career assessment is 22 adaptive questions that cover them by importance.</p>

        <div className="mt-7 space-y-5">
          {groups.map((g) => (
            <div key={g.imp}>
              <h2 className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">{IMPORTANCE_LABEL[g.imp]}</h2>
              <ul className="mt-2 flex flex-wrap gap-2">
                {g.skills.map((s) => (
                  <li key={s.name} className={`rounded-full px-3.5 py-1.5 text-[14px] font-bold ${g.imp === "CRITICAL" ? "bg-[var(--m-ink)] text-white" : "a-glass-soft text-[var(--m-ink)]"}`}>{s.name}</li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {alternatives.length > 0 && (
          <div className="mt-8 border-t border-[var(--m-rule)] pt-5">
            <p className="text-[13.5px] font-bold text-[var(--m-muted)]">Not quite right? Choose one of these instead</p>
            <div className="mt-2.5 flex flex-wrap gap-2">
              {alternatives.map((a) => (
                <button key={a.careerId} type="button" onClick={() => onPick(a)} className="a-glass-soft a-tile rounded-full px-4 py-2 text-[14px] font-bold text-[var(--m-ink)]">{a.name}</button>
              ))}
            </div>
          </div>
        )}

        <div className="mt-8 flex flex-col-reverse gap-3 sm:flex-row sm:items-center sm:justify-between">
          <Button variant="ghost" onClick={onRetry} icon={<RotateCcw className="h-4 w-4" aria-hidden />}>Use different words</Button>
          <Button variant="accent" size="lg" onClick={onConfirm} loading={confirming} icon={<Check className="h-5 w-5" aria-hidden />} hint="Enter" autoFocus>Confirm &amp; continue</Button>
        </div>
      </motion.div>
    </section>
  );
}
