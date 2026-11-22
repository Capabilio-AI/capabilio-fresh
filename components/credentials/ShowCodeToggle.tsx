"use client";

import { useState } from "react";

/** Lets the owner choose whether their solution code appears on their credential's public page. They can change it whenever they like. */
export function ShowCodeToggle({ code, initial }: { code: string; initial: boolean }) {
  const [on, setOn] = useState(initial);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function change(next: boolean) {
    setBusy(true); setError(null);
    try {
      const res = await fetch(`/api/credentials/${code}`, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ showCode: next }) });
      if (!res.ok) throw new Error("Could not save that. Try again.");
      setOn(next);
    } catch (e) { setError((e as Error).message); } finally { setBusy(false); }
  }
  return (
    <div className="mt-2">
      <label className="flex items-start gap-2 text-[13.5px] text-[var(--m-ink)]"><input type="checkbox" checked={on} disabled={busy} onChange={(e) => void change(e.target.checked)} className="mt-0.5" />Show my solution code to people I share this with</label>
      {error && <p role="alert" className="mt-1 text-[12.5px] font-semibold text-red-700">{error}</p>}
    </div>
  );
}
