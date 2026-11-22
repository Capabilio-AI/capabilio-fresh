"use client";

import { useState } from "react";
import Link from "next/link";
import { ArrowRight, Compass, Loader2 } from "lucide-react";

interface Resolution {
  outcome: "career" | "pathway" | "both" | "none" | "unavailable";
  careers: { key: string; name: string; confidence: number }[];
  pathways: { key: string; name: string; kind: string; score: number }[];
  recorded: boolean;
}
const KIND: Record<string, string> = { exam: "Exam route", portfolio: "Portfolio route", credential: "Credential route", venture: "Own venture" };

/** The goal box: any goal in the student's own words. It never guesses: a goal we do not cover says so and is noted so it can be built. */
export function GoalBox({ heading = "What do you want to become?" }: { heading?: string }) {
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<Resolution | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (busy || text.trim().length < 2) return;
    setBusy(true); setError(null); setRes(null);
    try {
      const r = await fetch("/api/goals/resolve", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ text }) });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
      setRes(data as Resolution);
    } catch (err) { setError((err as Error).message); } finally { setBusy(false); }
  }

  return (
    <section aria-labelledby="goal-h" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
      <h2 id="goal-h" className="flex items-center gap-2 font-lp-display text-[22px] font-bold text-[var(--m-ink)]"><Compass size={20} aria-hidden />{heading}</h2>
      <p className="mt-1 text-[14.5px] leading-relaxed text-[var(--m-muted)]">Type it your way: a job, an exam, a creative career, your own business. Examples: fashion designer, UPSC, chartered accountant, backend developer.</p>
      <form onSubmit={submit} className="mt-3 flex flex-col gap-2 sm:flex-row">
        <label htmlFor="goal-in" className="sr-only">Your goal</label>
        <input id="goal-in" value={text} onChange={(e) => setText(e.target.value)} maxLength={300} placeholder="I want to become…" className="min-w-0 flex-1 rounded-xl border border-[var(--m-rule)] px-4 py-2.5 text-[15px] text-[var(--m-ink)] outline-none focus:border-[var(--m-ink)]" />
        <button type="submit" disabled={busy || text.trim().length < 2} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-2.5 text-[14.5px] font-bold text-white disabled:opacity-50">{busy ? <><Loader2 size={15} className="animate-spin" aria-hidden />Looking…</> : "Find my route"}</button>
      </form>
      {error && <p role="alert" className="mt-3 text-[14px] font-semibold text-red-700">{error}</p>}

      <div role="status" aria-live="polite" className="mt-4 flex flex-col gap-3">
        {res?.pathways.map((p) => (
          <Link key={p.key} href={`/pathways/${p.key}`} className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--m-accent)] bg-[var(--m-accent-soft)] p-4">
            <span><span className="block text-[12px] font-bold uppercase tracking-wide text-[var(--m-accent-ink)]">{KIND[p.kind] ?? "Pathway"}</span><span className="block text-[17px] font-bold text-[var(--m-ink)]">{p.name}</span><span className="text-[13.5px] text-[var(--m-muted)]">A complete route: ways in, what to learn, where to start, where to watch for notifications.</span></span>
            <ArrowRight size={18} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        ))}
        {res?.careers.map((c) => (
          <Link key={c.key} href="/explore" className="group flex items-center justify-between gap-3 rounded-xl border border-[var(--m-rule)] p-4">
            <span><span className="block text-[12px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Job role on Capabilio</span><span className="block text-[17px] font-bold text-[var(--m-ink)]">{c.name}</span><span className="text-[13.5px] text-[var(--m-muted)]">Skills, learning, practice and proof for this role. Open Explore roles to read it and choose it.</span></span>
            <ArrowRight size={18} aria-hidden className="shrink-0 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" />
          </Link>
        ))}
        {res?.outcome === "unavailable" && <p role="alert" className="rounded-xl border border-[var(--m-rule)] bg-[var(--m-ground)] p-4 text-[14.5px] text-[var(--m-ink)]">We could not check job roles just now, so we cannot say whether this one is covered. Please try again in a minute.</p>}
        {res?.outcome === "none" && (
          <p className="rounded-xl border border-[var(--m-rule)] bg-[var(--m-ground)] p-4 text-[14.5px] leading-relaxed text-[var(--m-ink)]">
            We do not have a complete route for this yet, and we will not make one up. {res.recorded ? "We have noted it, so it counts toward what we build next." : "Please try again in a moment so we can note it."} In the meantime, browse the <Link href="/pathways" className="font-bold text-[var(--m-accent-ink)]">pathways we do cover</Link> or <Link href="/explore" className="font-bold text-[var(--m-accent-ink)]">explore job roles</Link>.
          </p>
        )}
      </div>
    </section>
  );
}
