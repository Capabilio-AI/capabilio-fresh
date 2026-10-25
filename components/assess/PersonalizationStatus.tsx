"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Hammer, Loader2, RotateCw } from "lucide-react";
import type { PartStatus, PersonalizationStatus as Status } from "@/lib/personalization/status";

const DELAYS_MS = [2000, 3000, 5000, 8000, 12000, 15000];
/** Polls quickly at first, then backs off; never faster than the first delay and never slower than the last. */
export const nextDelay = (attempt: number) => DELAYS_MS[Math.min(attempt, DELAYS_MS.length - 1)];

function Icon({ state }: { state: PartStatus["state"] }) {
  if (state === "ready") return <Check className="h-4 w-4 text-[var(--ok)]" aria-hidden />;
  if (state === "preparing" || state === "idle") return <Loader2 className="h-4 w-4 animate-spin text-[var(--m-accent)] motion-reduce:animate-none" aria-hidden />;
  if (state === "retry") return <RotateCw className="h-4 w-4 text-[var(--m-accent-ink)]" aria-hidden />;
  return <Hammer className="h-4 w-4 text-[var(--m-muted)]" aria-hidden />;
}

/** What is being prepared while the student works. Each line is one real piece of backend state; there are no percentages. */
export function PersonalizationStatusView({ status, onRetry, retrying = false }: { status: Status; onRetry?: () => void; retrying?: boolean }) {
  if (!status.career || status.parts.length === 0) return null;
  return (
    <section aria-label={`Preparing your ${status.career.name} experience`} className="a-glass-soft mx-auto mt-6 w-full max-w-3xl rounded-2xl px-5 py-4">
      <p className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">Getting {status.career.name} ready</p>
      <ul className="mt-2 space-y-1.5" aria-live="polite">
        {status.parts.map((p) => (
          <li key={p.key} className="flex items-center gap-2.5 text-[14px] text-[var(--m-ink)]">
            <Icon state={p.state} />
            <span>{p.label}</span>
            {p.state === "retry" && onRetry && (
              <button type="button" onClick={onRetry} disabled={retrying} className="ml-1 rounded-full px-2.5 py-0.5 text-[13px] font-bold text-[var(--m-accent-ink)] underline-offset-2 hover:underline disabled:opacity-60">
                {retrying ? "Retrying" : "Retry"}
              </button>
            )}
          </li>
        ))}
      </ul>
    </section>
  );
}

/**
 * Polls /api/personalization/status with backoff until nothing is still being prepared. It is cancelled on unmount, paused while the tab is
 * hidden, and never blocks the assessment: a failed poll just tries again later and leaves the last known state on screen.
 */
export function PersonalizationStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [retrying, setRetrying] = useState(false);
  const restart = useRef<() => void>(() => undefined);

  useEffect(() => {
    let attempt = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let controller: AbortController | null = null;
    let startedPathway = false;
    let stopped = false;

    const later = () => { timer = setTimeout(() => void poll(), nextDelay(attempt++)); };
    async function poll(): Promise<void> {
      if (stopped) return;
      if (document.hidden) return later(); // nothing to show to a tab nobody is looking at
      controller?.abort();
      const ctl = new AbortController();
      controller = ctl;
      let settled = false;
      try {
        const res = await fetch("/api/personalization/status", { signal: ctl.signal, cache: "no-store" });
        if (res.ok) {
          const next = (await res.json()) as Status;
          setStatus(next);
          settled = next.settled && !next.parts.some((p) => p.state === "idle");
          // a role whose pathway never started (a missed trigger, a refresh) starts it once; the server makes this idempotent
          if (!startedPathway && next.parts.some((p) => p.key === "pathway" && p.state === "idle")) {
            startedPathway = true;
            void fetch("/api/roadmap/generate", { method: "POST", signal: ctl.signal }).catch(() => undefined);
          }
        }
      } catch {
        if (ctl.signal.aborted) return;
      }
      if (!settled && !stopped) later();
    }

    restart.current = () => { clearTimeout(timer); attempt = 0; void poll(); };
    void poll();
    return () => { stopped = true; controller?.abort(); clearTimeout(timer); };
  }, []);

  const retry = async () => {
    setRetrying(true);
    try { await fetch("/api/roadmap/generate", { method: "POST" }); } catch { /* the next poll shows the real state */ }
    setRetrying(false);
    restart.current();
  };

  return status ? <PersonalizationStatusView status={status} onRetry={() => void retry()} retrying={retrying} /> : null;
}
