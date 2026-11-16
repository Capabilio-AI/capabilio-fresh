"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Pause, X } from "lucide-react";
import clsx from "clsx";
import { MAX_REASON, MIN_REASON } from "@/lib/admin/rules";

type Kind = "mentor" | "organisation" | "executive";
type Mode = "approved" | "rejected" | "hold";

const DONE: Record<Mode, string> = { approved: "Approved", rejected: "Rejected", hold: "Put on hold" };
const COPY: Record<Mode, { button: string; ask: string; placeholder: string; submit: string }> = {
  approved: { button: "Approve", ask: "Add a note for them (optional)", placeholder: "Anything they should know, for example what to do next.", submit: "Approve and notify" },
  rejected: { button: "Reject", ask: "Why is this being rejected? They will read this on their profile and in an email.", placeholder: "Be specific and kind: what did not match, and what they can fix.", submit: "Reject and notify" },
  hold: { button: "Hold", ask: "What is needed before this can move on? They will be told.", placeholder: "For example: please send your college's authorisation letter.", submit: "Hold and notify" },
};

/** Approve, hold or reject one request. A rejection or a hold needs a reason, because the person is told it in the app and by email. */
export function DecisionPanel({ kind, id, name, canApprove = true }: { kind: Kind; id: string; name: string; canApprove?: boolean }) {
  const router = useRouter();
  const [mode, setMode] = useState<Mode | null>(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);

  const need = mode === "rejected" ? MIN_REASON : mode === "hold" ? 5 : 0;
  const ok = mode !== null && reason.trim().length >= need;

  async function submit() {
    if (!mode || !ok || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/admin/decisions", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ kind, id, decision: mode, reason: reason.trim() || undefined }) });
      const out = (await res.json().catch(() => ({}))) as { error?: string; inApp?: boolean; email?: string; logged?: boolean };
      if (!res.ok) { setError(out.error ?? "Could not save. Try again."); return; }
      const told = [out.inApp ? "told in the app" : null, out.email === "sent" ? "emailed" : out.email === "not_configured" ? "email is not set up yet, so nothing was sent" : out.email === "failed" ? "the email failed to send" : null].filter(Boolean).join("; ");
      setDone(`${DONE[mode]} ${name}${told ? `: ${told}` : ""}${out.logged === false ? ". The decision log table is missing, so this was not logged" : ""}.`);
      setMode(null);
      setReason("");
      router.refresh();
    } catch {
      setError("Could not reach the server. Try again.");
    } finally {
      setBusy(false);
    }
  }

  if (done) return <p role="status" className="rounded-xl bg-[#dff5ea] px-4 py-3 font-lp-body text-[13px] font-semibold text-[#0b5d3f]">{done}</p>;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap gap-2" role="group" aria-label={`Decision for ${name}`}>
        {canApprove && <button type="button" onClick={() => setMode(mode === "approved" ? null : "approved")} aria-pressed={mode === "approved"} className={clsx("inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-lp-body text-[13px] font-bold transition-colors", mode === "approved" ? "bg-[#0b5d3f] text-white" : "bg-[#dff5ea] text-[#0b5d3f] hover:bg-[#c9edd9]")}><Check size={14} aria-hidden />Approve</button>}
        <button type="button" onClick={() => setMode(mode === "hold" ? null : "hold")} aria-pressed={mode === "hold"} className={clsx("inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-lp-body text-[13px] font-bold transition-colors", mode === "hold" ? "bg-[#3d2fb0] text-white" : "bg-[#e6e3fb] text-[#3d2fb0] hover:bg-[#d8d3f7]")}><Pause size={14} aria-hidden />Hold</button>
        <button type="button" onClick={() => setMode(mode === "rejected" ? null : "rejected")} aria-pressed={mode === "rejected"} className={clsx("inline-flex items-center gap-1.5 rounded-full px-4 py-2 font-lp-body text-[13px] font-bold transition-colors", mode === "rejected" ? "bg-[#8e1228] text-white" : "bg-[#fde3e8] text-[#8e1228] hover:bg-[#fbd0d9]")}><X size={14} aria-hidden />Reject</button>
      </div>
      {mode && (
        <div className="rounded-xl border border-[var(--m-rule)] bg-[var(--m-ground)]/60 p-3">
          <label className="block font-lp-body text-[13px] font-semibold text-[var(--m-ink)]" htmlFor={`reason-${id}`}>{COPY[mode].ask}</label>
          <textarea id={`reason-${id}`} value={reason} onChange={(e) => setReason(e.target.value.slice(0, MAX_REASON))} rows={3} placeholder={COPY[mode].placeholder} className="mt-2 w-full resize-y rounded-lg border border-[var(--m-rule)] bg-white px-3 py-2 font-lp-body text-[13.5px] text-[var(--m-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]" />
          <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
            <span className={clsx("font-lp-body text-[12px]", ok || need === 0 ? "text-[var(--m-muted)]" : "text-[#8e1228]")}>{need > 0 && !ok ? `At least ${need} characters. ` : ""}{reason.length}/{MAX_REASON}</span>
            <button type="button" onClick={() => void submit()} disabled={!ok || busy} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2 font-lp-body text-[13px] font-bold text-white disabled:opacity-40">{busy && <Loader2 size={14} className="animate-spin" aria-hidden />}{COPY[mode].submit}</button>
          </div>
        </div>
      )}
      {error && <p role="alert" className="font-lp-body text-[13px] font-semibold text-[#8e1228]">{error}</p>}
    </div>
  );
}
