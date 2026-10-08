"use client";

import { useState } from "react";
import { Loader2, X } from "lucide-react";

const REASONS = [
  { value: "spam", label: "Spam or scam" },
  { value: "harassment", label: "Harassment or bullying" },
  { value: "inappropriate", label: "Inappropriate content" },
  { value: "impersonation", label: "Pretending to be someone else" },
  { value: "other", label: "Something else" },
] as const;

export type ReportTarget = "user" | "post" | "comment" | "story" | "message" | "community" | "community_post";

/** Report a profile, post, comment or story. The Capabilio team reviews every report; the person reported is not told who reported them. */
export function ReportDialog({ targetType, targetId, onClose }: { targetType: ReportTarget; targetId: string; onClose: () => void }) {
  const [reason, setReason] = useState<(typeof REASONS)[number]["value"]>("inappropriate");
  const [details, setDetails] = useState("");
  const [busy, setBusy] = useState(false);
  const [state, setState] = useState<{ ok: boolean; text: string } | null>(null);

  async function send() {
    setBusy(true);
    try {
      const res = await fetch("/api/pulse/report", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ targetType, targetId, reason, details: details.trim() || undefined }) });
      const json = (await res.json().catch(() => null)) as { error?: string } | null;
      setState(res.ok ? { ok: true, text: "Thanks. We'll review this." } : { ok: false, text: json?.error ?? "Couldn't send the report." });
    } catch {
      setState({ ok: false, text: "Couldn't reach the server." });
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4" role="dialog" aria-modal="true" aria-label="Report">
      <div className="w-full max-w-sm rounded-2xl bg-white p-5 shadow-2xl">
        <div className="flex items-center justify-between">
          <h2 className="font-lp-display text-[16px] font-bold text-[var(--m-ink)]">Report</h2>
          <button type="button" onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-app-muted hover:bg-app-background"><X size={16} /></button>
        </div>
        {state?.ok ? (
          <p role="status" className="mt-4 font-lp-body text-[13px] text-[var(--m-ink)]">{state.text}</p>
        ) : (
          <>
            <fieldset className="mt-3 flex flex-col gap-2">
              <legend className="sr-only">Reason</legend>
              {REASONS.map((r) => (
                <label key={r.value} className="flex items-center gap-2 font-lp-body text-[13px] text-[var(--m-ink)]">
                  <input type="radio" name="reason" checked={reason === r.value} onChange={() => setReason(r.value)} /> {r.label}
                </label>
              ))}
            </fieldset>
            <textarea value={details} onChange={(e) => setDetails(e.target.value.slice(0, 1000))} placeholder="Anything else we should know? (optional)" aria-label="Details" rows={3} className="mt-3 w-full resize-none rounded-lg border border-[var(--m-rule)] bg-app-background px-3 py-2 font-lp-body text-[13px] focus:border-app-orange focus:outline-none" />
            {state && <p role="alert" className="mt-2 font-lp-body text-[12px] text-app-rose">{state.text}</p>}
          </>
        )}
        <div className="mt-4 flex justify-end gap-2">
          <button type="button" onClick={onClose} className="rounded-lg px-4 py-2 font-lp-body text-[13px] text-app-muted hover:bg-app-background">{state?.ok ? "Close" : "Cancel"}</button>
          {!state?.ok && <button type="button" onClick={send} disabled={busy} className="flex items-center gap-2 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-60">{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />} Send report</button>}
        </div>
      </div>
    </div>
  );
}
