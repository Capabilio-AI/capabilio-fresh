"use client";

import { Timer } from "lucide-react";
import { useEffect, useRef, useState } from "react";

/**
 * The per-question clock. It counts down from the server-measured `secondsLeft` (never the browser's idea of when the question was
 * served) and calls onExpire exactly once. It stops the moment `running` is false, i.e. as soon as an option is picked.
 */
export function QuestionTimer({ questionId, secondsLeft, total, running, onExpire }: { questionId: string; secondsLeft: number; total: number; running: boolean; onExpire: () => void }) {
  const [left, setLeft] = useState(secondsLeft);
  const deadline = useRef(0);
  const fired = useRef(false);
  const expire = useRef(onExpire);
  useEffect(() => { expire.current = onExpire; });

  useEffect(() => {
    deadline.current = Date.now() + secondsLeft * 1000;
    fired.current = false;
    const reset = setTimeout(() => setLeft(secondsLeft), 0);
    return () => clearTimeout(reset);
  }, [questionId, secondsLeft]);

  useEffect(() => {
    if (!running) return;
    const tick = () => {
      const remaining = Math.max(0, Math.ceil((deadline.current - Date.now()) / 1000));
      setLeft(remaining);
      if (remaining <= 0 && !fired.current) {
        fired.current = true;
        expire.current();
      }
    };
    tick();
    const t = setInterval(tick, 250);
    return () => clearInterval(t);
  }, [running, questionId]);

  const urgent = left <= 10;
  return (
    <div className="flex items-center gap-2.5" role="timer" aria-label={`${left} seconds left`}>
      <span className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-bold tabular-nums transition-colors duration-300 ${urgent ? "bg-[var(--bad-soft)] text-[var(--bad-ink)]" : "a-glass-soft text-[var(--m-ink)]"}`}>
        <Timer className="h-3.5 w-3.5" aria-hidden />
        {left}s
      </span>
      <span className="hidden h-1.5 w-20 overflow-hidden rounded-full bg-[var(--m-ink)]/10 sm:block" aria-hidden>
        <span className={`block h-full rounded-full transition-[width] duration-300 ease-linear ${urgent ? "bg-[var(--bad)]" : "bg-[var(--m-ink)]"}`} style={{ width: `${Math.min(100, (left / total) * 100)}%` }} />
      </span>
      <span className="sr-only" aria-live={urgent && running ? "polite" : "off"}>{urgent && running && left % 5 === 0 ? `${left} seconds left` : ""}</span>
    </div>
  );
}
