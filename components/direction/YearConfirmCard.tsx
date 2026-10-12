"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";

const INPUT =
  "w-24 rounded-lg border border-app-border bg-white px-3 py-1.5 font-lp-body text-[13px] text-app-charcoal focus:border-app-orange focus:outline-none";

/**
 * Asks, once, for the program start and end year when neither is on file (normally given at signup). Once saved they are fixed;
 * the current year and semester come from these years and the college's academic calendar, never from the student.
 */
export function YearConfirmCard() {
  const router = useRouter();
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/direction/year", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ startYear: Number(start), endYear: Number(end), currentYearOverride: null }),
    });
    setSaving(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not save — try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="mb-5 rounded-xl border border-app-border bg-white p-4" role="region" aria-label="Your program years">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-orange-container text-app-orange">
          <GraduationCap size={16} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">Tell us when your program starts and ends</p>
          <p className="mt-0.5 font-lp-body text-[12px] text-app-muted">Just the two years. Your current year and semester follow from them and your college&apos;s calendar.</p>
          <div className="mt-3 flex flex-wrap items-end gap-3">
            <label className="font-lp-mono text-[11px] text-app-muted">
              Start year
              <input className={`${INPUT} mt-1 block`} inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value)} placeholder="2024" />
            </label>
            <label className="font-lp-mono text-[11px] text-app-muted">
              End year
              <input className={`${INPUT} mt-1 block`} inputMode="numeric" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="2028" />
            </label>
            <button type="button" disabled={saving} onClick={save} className="rounded-lg bg-app-charcoal px-3.5 py-2 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-60">
              {saving ? <Loader2 size={13} className="animate-spin" /> : "Save"}
            </button>
          </div>
          {error && <p className="mt-2 font-lp-body text-[12px] text-app-orange" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
