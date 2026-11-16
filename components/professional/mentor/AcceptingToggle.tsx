"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

/** Pause or resume new requests without changing anything else on the profile. */
export function AcceptingToggle({ accepting }: { accepting: boolean }) {
  const router = useRouter();
  const [on, setOn] = useState(accepting);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const flip = async () => {
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/professional/mentor/accepting", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ accepting: !on }) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) throw new Error(json.error ?? "That did not save. Try again.");
      setOn(!on);
      router.refresh();
    } catch (e) {
      setMsg(e instanceof Error ? e.message : "That did not save. Try again.");
    } finally {
      setBusy(false);
    }
  };
  return (
    <div>
      <button type="button" role="switch" aria-checked={on} onClick={flip} disabled={busy} className="inline-flex items-center gap-3 text-[14px] font-bold text-[var(--m-ink)] disabled:opacity-60">
        <span aria-hidden className={`relative h-6 w-11 rounded-full transition-colors ${on ? "bg-[var(--m-accent)]" : "bg-[var(--m-off)]"}`}><span className={`absolute top-0.5 size-5 rounded-full bg-white transition-all ${on ? "left-[22px]" : "left-0.5"}`} /></span>
        {on ? "Taking new requests" : "Not taking new requests"}
      </button>
      <p role="status" className="mt-1 text-[12.5px] text-[var(--m-muted)]">{msg}</p>
    </div>
  );
}
