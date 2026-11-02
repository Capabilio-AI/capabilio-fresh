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
 * workspace, come back tomorrow, open it on another device, and it resumes where it stopped instead of starting again. When it reaches zero it tells the
 * workspace, which asks the server to close the ticket as unanswered (the server checks its own record of the time first).
 */
export function WorkTimer({ attemptId, limitSeconds, spentAtOpen, running, onTimeUp }: { attemptId: string; limitSeconds: number; spentAtOpen: number; running: boolean; onTimeUp?: () => void }) {
  const [spent, setSpent] = useState(spentAtOpen);
  const spentRef = useRef(spentAtOpen);
  const onTimeUpRef = useRef(onTimeUp);
  const lastTimeUpCall = useRef(0);
  useEffect(() => {
    onTimeUpRef.current = onTimeUp;
  });

  useEffect(() => {
    if (!running) return;
    const visible = () => typeof document === "undefined" || document.visibilityState === "visible";
    const tick = setInterval(() => {
      if (!visible()) return;
      spentRef.current += 1;
      setSpent(spentRef.current);
      // at zero, ask for the ticket to be settled; if the server says it is not quite time (its clock lags a little), ask again every few seconds
      if (limitSeconds - spentRef.current <= 0 && Date.now() - lastTimeUpCall.current > 8000) {
        lastTimeUpCall.current = Date.now();
        onTimeUpRef.current?.();
      }
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
  }, [attemptId, running, limitSeconds]);

  const left = limitSeconds - spent;
  const low = left <= 120;
  return (
    <span className={`font-lp-mono tabular-nums ${left <= 0 ? "text-app-rose" : low ? "text-app-warning" : ""}`} title="This clock runs only while the workspace is open, and picks up where you left off. If it reaches zero before you submit, the ticket closes unanswered.">
      {left > 0 ? `${formatClock(left)} left${low ? " · submit before it ends" : ""}` : "Time is up"}
    </span>
  );
}
