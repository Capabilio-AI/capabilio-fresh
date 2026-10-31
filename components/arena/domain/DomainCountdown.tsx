"use client";

import { useEffect, useState } from "react";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";

const pad = (n: number) => String(n).padStart(2, "0");

/** Banner shown after a Domain ticket is passed: counts down to the next ticket, then refreshes the page so it appears. */
export function DomainCountdown({ unlockAt }: { unlockAt: string }) {
  const router = useRouter();
  const target = new Date(unlockAt).getTime();
  // null until mounted so server and client render the same placeholder.
  const [left, setLeft] = useState<number | null>(null);

  useEffect(() => {
    const first = setTimeout(() => setLeft(Math.max(0, target - Date.now())), 0);
    const id = setInterval(() => {
      const next = Math.max(0, target - Date.now());
      setLeft(next);
      if (next === 0) {
        clearInterval(id);
        router.refresh();
      }
    }, 1000);
    return () => { clearTimeout(first); clearInterval(id); };
  }, [target, router]);

  const s = Math.floor((left ?? 0) / 1000);
  return (
    <div className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-center" role="timer" aria-live="off">
      <Lock size={18} className="mx-auto text-app-muted" />
      <p className="mt-2 font-lp-body text-[13px] text-app-muted">Ticket passed. Your next Domain ticket unlocks in</p>
      <p className="mt-1 font-lp-mono text-[28px] font-bold text-[var(--m-ink)]">{left === null ? "--:--:--" : `${pad(Math.floor(s / 3600))}:${pad(Math.floor((s % 3600) / 60))}:${pad(s % 60)}`}</p>
    </div>
  );
}
