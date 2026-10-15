"use client";

import { useState, useTransition } from "react";
import { finishStudies } from "@/app/(app)/settings/stage-actions";

/** A current student says they have finished; two clicks so it is never an accident. */
export function FinishStudiesCard() {
  const [confirming, setConfirming] = useState(false);
  const [error, setError] = useState<string | undefined>();
  const [pending, start] = useTransition();

  return (
    <div className="flex flex-col items-start gap-2 sm:items-end">
      {confirming ? (
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={() => start(async () => setError((await finishStudies())?.error))}
            className="rounded-full bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-white disabled:opacity-60"
          >
            {pending ? "Moving…" : "Yes, I have graduated"}
          </button>
          <button type="button" disabled={pending} onClick={() => setConfirming(false)} className="rounded-full px-3 py-2 text-[13px] font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)]">
            Not yet
          </button>
        </div>
      ) : (
        <button type="button" onClick={() => setConfirming(true)} className="rounded-full border border-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-[var(--m-ink)] hover:bg-[var(--m-ground)]">
          I have finished my studies
        </button>
      )}
      <p role="alert" className="text-[12.5px] font-semibold text-red-600">{error}</p>
    </div>
  );
}
