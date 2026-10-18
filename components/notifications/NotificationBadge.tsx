"use client";

import { useEffect, useState } from "react";

const POLL_MS = 45_000;

/** Unread count for the bell. Polls while the tab is visible and refreshes when the person comes back to it. */
export function NotificationBadge({ className = "" }: { className?: string }) {
  const [unread, setUnread] = useState(0);

  useEffect(() => {
    let stopped = false;
    async function load() {
      if (document.visibilityState === "hidden") return;
      try {
        const res = await fetch("/api/notifications?countOnly=1", { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { unread?: number };
        if (!stopped && typeof json.unread === "number") setUnread(json.unread);
      } catch {
        // offline or a blip: keep the last count
      }
    }
    load();
    const timer = setInterval(load, POLL_MS);
    document.addEventListener("visibilitychange", load);
    window.addEventListener("focus", load);
    // the list page tells the bell when it marks things read, so the count drops immediately
    window.addEventListener("notifications:changed", load);
    return () => {
      stopped = true;
      clearInterval(timer);
      document.removeEventListener("visibilitychange", load);
      window.removeEventListener("focus", load);
      window.removeEventListener("notifications:changed", load);
    };
  }, []);

  if (unread === 0) return null;
  return (
    <span className={`flex min-w-[18px] items-center justify-center rounded-full bg-app-orange px-1 font-lp-mono text-[10px] font-semibold text-white ${className}`} aria-label={`${unread} unread notifications`}>
      {unread > 99 ? "99+" : unread}
    </span>
  );
}
