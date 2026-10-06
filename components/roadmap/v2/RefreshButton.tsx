"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, RefreshCw } from "lucide-react";
import { send } from "./api";

/** Recomputes the roadmap from the student's current data. If nothing changed it says so and writes nothing. */
export function RefreshButton() {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  async function run() {
    setBusy(true);
    setMsg(null);
    const r = await send("POST", "/api/roadmap/refresh");
    setBusy(false);
    if (!r.ok) return setMsg(r.error ?? "Couldn't refresh.");
    setMsg(r.data?.upToDate ? "Already up to date — nothing has changed since your last version." : "Updated — a new version was added to your history.");
    router.refresh();
  }
  return (
    <div className="flex flex-col items-start gap-1 sm:items-end">
      <button type="button" onClick={run} disabled={busy} className="inline-flex min-h-10 items-center gap-1.5 rounded-lg border border-app-border bg-white px-3 font-lp-body text-[13px] font-medium text-app-charcoal hover:bg-app-background disabled:opacity-60">
        {busy ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <RefreshCw size={14} aria-hidden />} Refresh roadmap
      </button>
      <p role="status" aria-live="polite" className="font-lp-body text-[12px] text-app-muted">{msg}</p>
    </div>
  );
}
