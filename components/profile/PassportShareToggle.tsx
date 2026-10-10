"use client";

import { useState, useTransition } from "react";
import { setPassportSharing } from "@/app/(app)/profile/passport-actions";

export function PassportShareToggle({ initial }: { initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [error, setError] = useState(false);
  const [pending, start] = useTransition();

  function toggle() {
    const next = !on;
    setError(false);
    setOn(next);
    start(async () => {
      const r = await setPassportSharing(next);
      if (!r.ok) {
        setOn(!next);
        setError(true);
      }
    });
  }

  return (
    <div>
      <button type="button" role="switch" aria-checked={on} onClick={toggle} disabled={pending}
        className="group flex items-center gap-3 text-left disabled:opacity-60">
        <span aria-hidden className={`relative h-8 w-[68px] shrink-0 rounded-full transition-colors ${on ? "bg-[var(--m-accent)]" : "bg-[var(--m-soft)]"}`}>
          <span className={`absolute top-1/2 -translate-y-1/2 font-lp-body text-[11px] font-extrabold tracking-wider ${on ? "left-3 text-white" : "right-3 text-[var(--m-muted)]"}`}>{on ? "ON" : "OFF"}</span>
          <span className={`absolute top-1 h-6 w-6 rounded-full bg-white shadow-md transition-all ${on ? "left-[38px]" : "left-1"}`} />
        </span>
        <span className="font-lp-body">
          <span className="block text-[14px] font-bold text-[var(--m-ink)]">{on ? "QR is live" : "QR is off"}</span>
          <span className="block text-[12.5px] text-[var(--m-muted)]">{on ? "Anyone who scans it sees your passport" : "The passport page is private"}</span>
        </span>
      </button>
      {error && <p role="alert" className="mt-1.5 font-lp-body text-[12px] text-[var(--m-accent-ink)]">Couldn&apos;t change that. Please try again.</p>}
    </div>
  );
}
