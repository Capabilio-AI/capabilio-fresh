"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";

/** Starts (or resumes) a challenge attempt and opens its workstation. Shows the server's reason if it can't start. */
export function StartChallengeButton({ challengeId, label = "Start", className = "" }: { challengeId: string; label?: string; className?: string }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function start() {
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/arena/challenge-attempts", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ challengeId }) });
      const body = await res.json();
      if (res.ok) router.push(`/arena/challenges/attempt/${body.attemptId}`);
      else setError(body.error ?? "Could not start this challenge.");
    } catch {
      setError("Could not reach the server.");
    }
    setBusy(false);
  }

  return (
    <span className="inline-flex flex-col items-end gap-1">
      <button type="button" onClick={start} disabled={busy} className={className || "inline-flex items-center gap-1.5 rounded-full bg-app-blue px-4 py-1.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-60"}>
        {busy && <Loader2 size={12} className="animate-spin" />}
        {busy ? "Preparing your workstation…" : label}
      </button>
      {error && <span role="alert" className="max-w-[240px] text-right font-lp-body text-[11.5px] text-app-rose">{error}</span>}
    </span>
  );
}
