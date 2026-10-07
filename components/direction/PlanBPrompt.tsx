"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "@/components/roadmap/v2/api";

interface Career { id: string; name: string }

/** Asked once, in 3-1. The server stops rendering it as soon as a Plan B is saved. */
export function PlanBPrompt({ mainCareer, careers }: { mainCareer: string; careers: Career[] }) {
  const router = useRouter();
  const [choice, setChoice] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const save = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const r = await send("PUT", "/api/career-intent", { secondaryCareerId: choice });
    setBusy(false);
    if (r.ok) router.refresh();
    else setError(r.error ?? "Something went wrong. Please try again.");
  };

  return (
    <form onSubmit={save} className="rounded-xl border border-app-border bg-white p-4">
      <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">Choose your Plan B career</p>
      <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">Your main career is {mainCareer}. Pick a second career you&apos;d be happy with — we&apos;ll build a roadmap and baseline check for it too. You&apos;re asked once.</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        <label htmlFor="plan-b" className="sr-only">Plan B career</label>
        <select id="plan-b" value={choice} onChange={(e) => setChoice(e.target.value)} className="min-h-10 min-w-56 rounded-lg border border-app-border bg-white px-3 font-lp-body text-[13px]">
          <option value="">Select a career…</option>
          {careers.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <button type="submit" disabled={busy || !choice} className="min-h-10 rounded-lg bg-app-charcoal px-4 font-lp-body text-[13px] font-medium text-white disabled:opacity-60">{busy ? "Saving…" : "Save Plan B"}</button>
      </div>
      <p role="status" aria-live="polite" className="mt-2 font-lp-body text-[12.5px] text-app-rose">{error}</p>
    </form>
  );
}
