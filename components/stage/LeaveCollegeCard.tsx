"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** A student leaves their college. Two clicks so it is never an accident; their account and work stay. */
export function LeaveCollegeCard() {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function leave() {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/profile/leave-college", { method: "POST" }).catch(() => null);
    setBusy(false);
    if (!res?.ok) return setError(((await res?.json().catch(() => null)) as { error?: string } | null)?.error ?? "Couldn't update. Please try again.");
    router.refresh();
  }

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <button type="button" disabled={busy} onClick={leave} className="rounded-full bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-[#fff] disabled:opacity-60">{busy ? "Leaving…" : "Yes, leave my college"}</button>
          <button type="button" disabled={busy} onClick={() => setConfirming(false)} className="rounded-full px-3 py-2 text-[13px] font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)]">Stay</button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="rounded-full border border-[var(--m-rule)] px-4 py-2 text-[13px] font-bold text-[var(--m-ink)] hover:bg-app-background">Leave my college</button>
      )}
      {error && <p role="alert" className="text-[12.5px] text-app-rose">{error}</p>}
    </div>
  );
}
