"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flag, Loader2 } from "lucide-react";

/** "Make this my goal" for a published pathway; once chosen it says so and can be undone. */
export function ChooseGoal({ pathwayKey, chosen }: { pathwayKey: string; chosen: boolean }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    setBusy(true); setError(null);
    try {
      const res = await fetch("/api/pathways/goal", chosen ? { method: "DELETE" } : { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ key: pathwayKey }) });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(typeof data.error === "string" ? data.error : "Something went wrong. Try again.");
      router.refresh();
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }

  return (
    <div className="flex flex-col gap-1">
      <button type="button" onClick={toggle} disabled={busy} aria-pressed={chosen} className={`inline-flex w-fit items-center gap-2 rounded-full px-5 py-2.5 text-[14.5px] font-bold disabled:opacity-60 ${chosen ? "border border-[var(--m-ink)] bg-white text-[var(--m-ink)]" : "bg-[var(--m-ink)] text-white"}`}>
        {busy ? <Loader2 size={15} className="animate-spin" aria-hidden /> : chosen ? <Check size={15} aria-hidden /> : <Flag size={15} aria-hidden />}{chosen ? "This is your goal (tap to remove)" : "Make this my goal"}
      </button>
      {error && <p role="alert" className="text-[13.5px] font-semibold text-red-700">{error}</p>}
    </div>
  );
}
