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
        className="flex items-center gap-3 font-lp-body text-[13.5px] font-bold text-[var(--m-ink)] disabled:opacity-60">
        <span aria-hidden className={`relative h-6 w-11 shrink-0 rounded-full transition-colors ${on ? "bg-[var(--m-accent)]" : "bg-[var(--m-soft)]"}`}>
          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${on ? "left-[22px]" : "left-0.5"}`} />
        </span>
        {on ? "QR is live: anyone who scans it sees your passport" : "QR is off: the passport page is private"}
      </button>
      {error && <p role="alert" className="mt-1.5 font-lp-body text-[12px] text-[var(--m-accent-ink)]">Couldn&apos;t change that. Please try again.</p>}
    </div>
  );
}
