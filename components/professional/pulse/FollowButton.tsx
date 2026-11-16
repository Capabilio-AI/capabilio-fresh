"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Follow or unfollow another professional. Shows the new state at once and puts it back if the server refuses. */
export function FollowButton({ userId, following }: { userId: string; following: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(following);
  const [busy, setBusy] = useState(false);
  const toggle = async () => {
    setBusy(true);
    setOn(!on);
    try {
      const res = await fetch("/api/professional/pulse/follow", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId }) });
      if (!res.ok) throw new Error("refused");
      router.refresh();
    } catch {
      setOn(on);
    } finally {
      setBusy(false);
    }
  };
  return <button type="button" onClick={toggle} disabled={busy} aria-pressed={on} className="shrink-0 rounded-full border border-[var(--m-ink)] px-3.5 py-1.5 text-[12.5px] font-bold text-[var(--m-ink)] hover:bg-[var(--m-ink)] hover:text-white disabled:opacity-45 aria-pressed:bg-[var(--m-ink)] aria-pressed:text-white">{on ? "Following" : "Follow"}</button>;
}
