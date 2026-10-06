"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { IntentView, SuggestionView, CareerRef } from "@/lib/careers/intent";
import { send } from "./api";

const SELECT = "min-h-10 w-full rounded-lg border border-app-border bg-white px-3 font-lp-body text-[13px]";

/** The student's own career choices: main career, Plan B, "I'm exploring", and a free-text goal that the AI only turns into SUGGESTIONS to accept or dismiss. */
export function GoalPicker({ intent, careers, suggestions }: { intent: IntentView; careers: CareerRef[]; suggestions: SuggestionView[] }) {
  const router = useRouter();
  const [primary, setPrimary] = useState(intent.primary?.id ?? "");
  const [secondary, setSecondary] = useState(intent.secondary?.id ?? "");
  const [exploring, setExploring] = useState(intent.isExploring);
  const [goalText, setGoalText] = useState("");
  const [busy, setBusy] = useState<string | null>(null);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);

  async function run(key: string, call: () => ReturnType<typeof send>, done: string) {
    setBusy(key);
    setMsg(null);
    const r = await call();
    setBusy(null);
    setMsg(r.ok ? { ok: true, text: done } : { ok: false, text: r.error ?? "Something went wrong." });
    if (r.ok) router.refresh();
    return r.ok;
  }
  const save = (e: React.FormEvent) => {
    e.preventDefault();
    return run("save", () => send("PUT", "/api/career-intent", { primaryCareerId: primary || null, secondaryCareerId: primary ? secondary || null : null, isExploring: exploring && !primary }), "Saved. Your roadmap is updating.");
  };
  const suggest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (await run("suggest", () => send("POST", "/api/career-intent/suggest", { goalText }), "Here's what we found — choose what fits, or dismiss it.")) setGoalText("");
  };

  return (
    <div className="flex flex-col gap-6">
      <form onSubmit={save} className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div>
          <label htmlFor="primary" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Main career</label>
          <select id="primary" value={primary} onChange={(e) => setPrimary(e.target.value)} className={SELECT}>
            <option value="">Not chosen yet</option>
            {careers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label htmlFor="secondary" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Plan B (optional)</label>
          <select id="secondary" value={secondary} onChange={(e) => setSecondary(e.target.value)} disabled={!primary} className={SELECT}>
            <option value="">None</option>
            {careers.filter((c) => c.id !== primary).map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <label className={`flex items-center gap-2 font-lp-body text-[13px] ${primary ? "text-app-muted" : "text-app-charcoal"}`}>
          <input type="checkbox" checked={exploring && !primary} disabled={!!primary} onChange={(e) => setExploring(e.target.checked)} /> I&apos;m still exploring — show me the best matches
        </label>
        <div className="sm:text-right">
          <button type="submit" disabled={busy !== null} className="min-h-10 rounded-lg bg-app-charcoal px-4 font-lp-body text-[13px] font-medium text-white disabled:opacity-60">{busy === "save" ? "Saving…" : "Save my choices"}</button>
        </div>
      </form>

      <form onSubmit={suggest} className="border-t border-app-border pt-5">
        <label htmlFor="goalText" className="mb-1 block font-lp-body text-[13px] font-medium text-app-charcoal">Not sure which career fits? Say it in your own words</label>
        <textarea id="goalText" value={goalText} onChange={(e) => setGoalText(e.target.value)} rows={2} maxLength={500} placeholder="e.g. I like working with data and building dashboards" className="w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13px]" />
        <button type="submit" disabled={busy !== null || goalText.trim().length < 3} className="mt-2 min-h-10 rounded-lg border border-app-border bg-white px-4 font-lp-body text-[13px] font-medium text-app-charcoal disabled:opacity-60">{busy === "suggest" ? "Thinking…" : "Suggest careers"}</button>
        <p className="mt-1 font-lp-body text-[12px] text-app-muted">These are suggestions only. Nothing changes until you choose one.</p>
      </form>

      {suggestions.map((s) => (
        <div key={s.id} className="rounded-xl border border-app-border bg-app-background p-4">
          <p className="font-lp-body text-[12.5px] text-app-muted">From &ldquo;{s.sourceText}&rdquo;</p>
          {s.careers.length === 0 ? <p className="mt-2 font-lp-body text-[13px] text-app-charcoal">We couldn&apos;t match that to a career we have. Try describing the work you&apos;d enjoy.</p> : (
            <ul className="mt-2 flex flex-col gap-2">
              {s.careers.map((c) => (
                <li key={c.id} className="flex flex-wrap items-center gap-2 font-lp-body text-[13px] text-app-charcoal">
                  <strong className="min-w-40">{c.name}</strong>
                  <button type="button" disabled={busy !== null} onClick={() => run(`a-${c.id}`, () => send("POST", `/api/career-intent/suggestions/${s.id}`, { action: "accept", careerId: c.id, as: "primary" }), `${c.name} is now your main career.`)} className="min-h-9 rounded-lg bg-app-charcoal px-3 text-[12.5px] font-medium text-white disabled:opacity-60">Use as main</button>
                  <button type="button" disabled={busy !== null || !primary} title={primary ? undefined : "Choose a main career first"} onClick={() => run(`b-${c.id}`, () => send("POST", `/api/career-intent/suggestions/${s.id}`, { action: "accept", careerId: c.id, as: "secondary" }), `${c.name} is now your Plan B.`)} className="min-h-9 rounded-lg border border-app-border bg-white px-3 text-[12.5px] font-medium disabled:opacity-50">Use as Plan B</button>
                </li>
              ))}
            </ul>
          )}
          <button type="button" disabled={busy !== null} onClick={() => run(`d-${s.id}`, () => send("POST", `/api/career-intent/suggestions/${s.id}`, { action: "dismiss" }), "Dismissed.")} className="mt-3 font-lp-body text-[12.5px] text-app-muted underline">Dismiss</button>
        </div>
      ))}
      <p role="status" aria-live="polite" className={`font-lp-body text-[12.5px] ${msg?.ok ? "text-app-success" : "text-app-rose"}`}>{msg?.text}</p>
    </div>
  );
}
