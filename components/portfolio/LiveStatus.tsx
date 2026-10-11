"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";

const POLL_MS = 15_000;
const SLOW_POLL_MS = 60_000;
const FLASH_MS = 4_000;
const MAX_FAILS = 3;

const rel = (iso: string | null, now: number) => {
  if (!iso) return "no activity yet";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

/**
 * Keeps the portfolio live. While the tab is visible it asks a tiny endpoint for a fingerprint of everything on the page every 15 seconds
 * and re-reads the page only when that fingerprint changed, so an idle portfolio costs almost nothing and new proof appears within seconds.
 * It pauses in a hidden tab, catches up on return, backs off when offline, and says which state it is in.
 */
export function LiveStatus({ pulseUrl, initialLatest }: { pulseUrl: string; initialLatest: string | null }) {
  const router = useRouter();
  const [latest, setLatest] = useState(initialLatest);
  const [now, setNow] = useState(() => Date.now());
  const [state, setState] = useState<"live" | "updated" | "offline">("live");
  const version = useRef<string | null>(null);
  const fails = useRef(0);

  useEffect(() => {
    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let flash: ReturnType<typeof setTimeout> | undefined;

    const check = async () => {
      if (document.visibilityState !== "visible") return schedule();
      try {
        const res = await fetch(pulseUrl, { cache: "no-store" });
        if (!res.ok) throw new Error(String(res.status));
        const pulse = (await res.json()) as { version: string; latest: string | null };
        if (cancelled) return;
        fails.current = 0;
        setNow(Date.now());
        if (version.current !== null && pulse.version !== version.current) {
          router.refresh();
          setLatest(pulse.latest);
          setState("updated");
          clearTimeout(flash);
          flash = setTimeout(() => setState("live"), FLASH_MS);
        } else if (state === "offline") setState("live");
        version.current = pulse.version;
      } catch {
        fails.current += 1;
        if (!cancelled && fails.current >= MAX_FAILS) setState("offline");
      }
      schedule();
    };
    const schedule = () => { if (!cancelled) timer = setTimeout(check, fails.current >= MAX_FAILS ? SLOW_POLL_MS : POLL_MS); };
    const onVisible = () => { if (document.visibilityState === "visible") { clearTimeout(timer); void check(); } };

    void check();
    document.addEventListener("visibilitychange", onVisible);
    return () => { cancelled = true; clearTimeout(timer); clearTimeout(flash); document.removeEventListener("visibilitychange", onVisible); };
    // state is read only to clear "offline"; re-subscribing on it would reset the poll loop
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pulseUrl, router]);

  const label = state === "offline" ? "Reconnecting…" : state === "updated" ? "Updated just now" : `Live · latest proof ${rel(latest, now)}`;
  return (
    <p className="inline-flex items-center gap-2 font-lp-body text-[12.5px] text-[var(--m-muted)]" role="status" aria-live="polite">
      <span className="relative flex h-2 w-2" aria-hidden>
        {state !== "offline" && <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--m-accent)] opacity-60 motion-safe:animate-ping" />}
        <span className={`relative inline-flex h-2 w-2 rounded-full ${state === "offline" ? "bg-[var(--m-off)]" : "bg-[var(--m-accent)]"}`} />
      </span>
      <span className={state === "updated" ? "font-bold text-[var(--m-ink)]" : ""}>{label}</span>
    </p>
  );
}
