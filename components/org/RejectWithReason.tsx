"use client";

import { FormEvent, useId, useState } from "react";
import { useRouter } from "next/navigation";

/** A Reject button that asks for a reason first. The reason is sent with the request and shown to the students. */
export function RejectWithReason({ action, body, label = "Reject", prompt = "Why can't you? The students will read this." }: { action: string; body: Record<string, unknown>; label?: string; prompt?: string }) {
  const router = useRouter();
  const id = useId();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const res = await fetch(action, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...body, reason: reason.trim() }) });
      if (!res.ok) throw new Error(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "That didn't work.");
      setBusy(false);
    }
  }

  if (!open) return <button type="button" onClick={() => setOpen(true)} className="o-btn-ghost">{label}</button>;
  return (
    <form onSubmit={submit} className="flex w-full flex-col gap-2 sm:w-80">
      <label htmlFor={id} className="font-lp-body text-[12px] font-semibold text-app-charcoal">{prompt}</label>
      <textarea id={id} value={reason} onChange={(e) => setReason(e.target.value)} required minLength={3} maxLength={500} rows={3} className="o-input" placeholder="For example: I am already mentoring four groups this semester." />
      {error && <p role="alert" className="font-lp-body text-[12px] text-app-rose">{error}</p>}
      <div className="flex gap-2">
        <button type="submit" disabled={busy || reason.trim().length < 3} className="o-btn">{busy ? "Sending…" : `Send ${label.toLowerCase()}`}</button>
        <button type="button" onClick={() => setOpen(false)} className="o-btn-ghost">Cancel</button>
      </div>
    </form>
  );
}
