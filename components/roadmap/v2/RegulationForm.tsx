"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { send } from "./api";

/** Which syllabus scheme the student is on (as printed on their syllabus). Only that regulation's curriculum is used for them. */
export function RegulationForm({ current }: { current: string | null }) {
  const router = useRouter();
  const [value, setValue] = useState(current ?? "");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<{ ok: boolean; text: string } | null>(null);
  async function save(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setMsg(null);
    const r = await send("PUT", "/api/roadmap/regulation", { regulation: value.trim() || null });
    setBusy(false);
    setMsg(r.ok ? { ok: true, text: "Saved." } : { ok: false, text: r.error ?? "Couldn't save." });
    if (r.ok) router.refresh();
  }
  return (
    <form onSubmit={save} className="mt-3 flex flex-col gap-2 sm:flex-row sm:items-end">
      <div>
        <label htmlFor="regulation" className="mb-1 block font-lp-mono text-[11px] text-app-muted">Your regulation (e.g. R23)</label>
        <input id="regulation" value={value} onChange={(e) => setValue(e.target.value)} maxLength={40} className="min-h-10 w-full rounded-lg border border-app-border bg-white px-3 font-lp-body text-[13px] sm:w-48" />
      </div>
      <button type="submit" disabled={busy} className="min-h-10 rounded-lg bg-app-charcoal px-4 font-lp-body text-[13px] font-medium text-white disabled:opacity-60">{busy ? "Saving…" : "Save"}</button>
      <p role="status" aria-live="polite" className={`font-lp-body text-[12px] ${msg?.ok ? "text-app-success" : "text-app-rose"}`}>{msg?.text}</p>
    </form>
  );
}
