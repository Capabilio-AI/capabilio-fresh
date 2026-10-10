"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const REFRESH_MS = 60_000;
const rel = (iso: string | null, now: number) => {
  if (!iso) return "no activity yet";
  const m = Math.max(0, Math.round((now - Date.parse(iso)) / 60_000));
  if (m < 1) return "just now";
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  if (h < 48) return `${h} h ago`;
  return `${Math.round(h / 24)} days ago`;
};

/** Keeps the portfolio live: re-reads the server data every minute while the tab is open and on return to it, and says when the latest proof landed. */
export function LiveStatus({ latestActivity }: { latestActivity: string | null }) {
  const router = useRouter();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const tick = () => { if (document.visibilityState === "visible") { router.refresh(); setNow(Date.now()); } };
    const id = setInterval(tick, REFRESH_MS);
    document.addEventListener("visibilitychange", tick);
    return () => { clearInterval(id); document.removeEventListener("visibilitychange", tick); };
  }, [router]);

  return (
    <p className="inline-flex items-center gap-2 font-lp-body text-[12.5px] text-[var(--m-muted)]" role="status">
      <span className="relative flex h-2 w-2" aria-hidden>
        <span className="absolute inline-flex h-full w-full rounded-full bg-[var(--m-accent)] opacity-60 motion-safe:animate-ping" />
        <span className="relative inline-flex h-2 w-2 rounded-full bg-[var(--m-accent)]" />
      </span>
      Live record · latest proof {rel(latestActivity, now)}
    </p>
  );
}
