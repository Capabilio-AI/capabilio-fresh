"use client";

import { useEffect, useRef, useState } from "react";

const pad = (n: number) => String(n).padStart(2, "0");
export const BEAT_EVERY_SECONDS = 15;

/** m:ss, with hours when there are any. */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.floor(totalSeconds));
  const h = Math.floor(s / 3600);
  return h > 0 ? `${h}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}` : `${pad(Math.floor(s / 60))}:${pad(s % 60)}`;
}

/**
 * A ticket's clock. It runs only while this workspace is open and the page is visible, and it is kept on the ticket in the student's account: close the
 * workspace, come back tomorrow, open it on another device, and it resumes where it stopped instead of starting again. Running out of time does not close
 * the workspace or change anything; the clock just shows how far over the estimate the student is.
 */
export function WorkTimer({ attemptId, limitSeconds, spentAtOpen, running }: { attemptId: string; limitSeconds: number; spentAtOpen: number; running: boolean }) {
  const [spent, setSpent] = useState(spentAtOpen);
  const spentRef = useRef(spentAtOpen);

  useEffect(() => {
    if (!running) return;
    const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
    const tick = setInterval(() => {
      if (!visible()) return;
      spentRef.current += 1;
      setSpent(spentRef.current);
    }, 1000);
    const beat = () => {
      if (!visible()) return;
      fetch(`/api/arena/domain/attempts/${attemptId}/time`, { method: "POST", keepalive: true })
        .then((r) => (r.ok ? r.json() : null))
        .then((b: { timeSpentSeconds?: number | null } | null) => {
          // the account's clock is the record; never let the display jump backwards because of it
          if (b && typeof b.timeSpentSeconds === "number" && b.timeSpentSeconds > spentRef.current) {
            spentRef.current = b.timeSpentSeconds;
            setSpent(b.timeSpentSeconds);
          }
        })
        .catch(() => undefined);
    };
    beat();
    const beats = setInterval(beat, BEAT_EVERY_SECONDS * 1000);
    return () => {
      clearInterval(tick);
      clearInterval(beats);
      beat(); // one last report when the workspace closes
    };
  }, [attemptId, running]);

  const left = limitSeconds - spent;
  return (
    <span className={`font-lp-mono tabular-nums ${left < 0 ? "text-app-rose" : ""}`} title="This clock runs only while the workspace is open, and picks up where you left off.">
      {left >= 0 ? `${formatClock(left)} left` : `${formatClock(-left)} over the estimate`}
    </span>
  );
}
