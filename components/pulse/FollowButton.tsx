"use client";

import { useState } from "react";
import { Check, Loader2, UserPlus } from "lucide-react";
import clsx from "clsx";

/** Optimistic follow toggle that rolls back (and says so) when the server refuses. */
export function FollowButton({ userId, initialFollowing, compact = false, onChange }: { userId: string; initialFollowing: boolean; compact?: boolean; onChange?: (following: boolean) => void }) {
  const [following, setFollowing] = useState(initialFollowing);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function toggle() {
    const next = !following;
    setFollowing(next);
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(`/api/pulse/follow/${userId}`, { method: next ? "POST" : "DELETE" });
      if (!res.ok) {
        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        setFollowing(!next);
        setError(body?.error ?? "Couldn't update. Try again.");
        return;
      }
      onChange?.(next);
    } catch {
      setFollowing(!next);
      setError("Couldn't reach the server.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <span className="inline-flex flex-col items-end">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={following}
        className={clsx(
          "inline-flex items-center gap-1.5 rounded-full font-lp-body font-semibold transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-orange/40 disabled:opacity-70",
          compact ? "px-3 py-1 text-[12px]" : "px-4 py-2 text-[13px]",
          following ? "border border-app-border bg-white text-app-charcoal hover:bg-app-background" : "bg-app-charcoal text-white hover:bg-black"
        )}
      >
        {busy ? <Loader2 size={13} className="animate-spin" aria-hidden="true" /> : following ? <Check size={13} aria-hidden="true" /> : <UserPlus size={13} aria-hidden="true" />}
        {following ? "Following" : "Follow"}
      </button>
      {error && <span role="alert" className="mt-1 font-lp-body text-[11px] text-app-rose">{error}</span>}
    </span>
  );
}
