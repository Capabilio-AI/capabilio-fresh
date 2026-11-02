"use client";

import { useState } from "react";
import { EMPLOYMENT_LABEL, WORK_MODE_LABEL } from "@/lib/hiring/format";
import type { CompanyOpening } from "@/lib/hiring/types";

const MIN_NOTE = 40;

/** Company roles for a signed-in student. Applying attaches their Skill Passport; the note is why they fit. */
export function JobBoard({ openings, appliedIds }: { openings: CompanyOpening[]; appliedIds: string[] }) {
  const [applied, setApplied] = useState(() => new Set(appliedIds));
  const [open, setOpen] = useState<string | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function apply(openingId: string) {
    setBusy(true);
    setError(null);
    const res = await fetch("/api/jobs/apply", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ openingId, proofNote: note }) });
    setBusy(false);
    if (!res.ok) return setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.");
    setApplied((prev) => new Set(prev).add(openingId));
    setOpen(null);
    setNote("");
  }

  if (openings.length === 0) return <p className="font-lp-body text-[13px] text-app-muted">No company roles are open right now. Check back soon.</p>;
  return (
    <ul className="flex flex-col gap-3">
      {openings.map((o) => (
        <li key={o.id} className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
          <p className="font-lp-body text-[12px] font-semibold uppercase tracking-wide text-app-muted">{o.companyName}</p>
          <h2 className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">{o.title}</h2>
          <p className="font-lp-body text-[12.5px] text-app-muted">{o.team} · {o.location} · {WORK_MODE_LABEL[o.workMode]} · {EMPLOYMENT_LABEL[o.employmentType]}{o.compensation ? ` · ${o.compensation}` : ""}</p>
          <p className="mt-2 font-lp-body text-[13.5px] text-[var(--m-ink)]">{o.summary}</p>
          {o.requirements.length > 0 && <ul className="mt-2 list-disc pl-5 font-lp-body text-[13px] text-[var(--m-ink)]">{o.requirements.map((r) => <li key={r}>{r}</li>)}</ul>}
          {applied.has(o.id) ? (
            <p className="mt-3 font-lp-body text-[13px] font-semibold text-[#17784a]">Applied. The company can see your Skill Passport.</p>
          ) : open === o.id ? (
            <div className="mt-3 grid gap-2">
              <label htmlFor={`note-${o.id}`} className="font-lp-body text-[12.5px] font-semibold">Why are you a fit? Point to something you built or proved.</label>
              <textarea id={`note-${o.id}`} value={note} onChange={(e) => setNote(e.target.value)} rows={4} maxLength={2000} className="rounded-lg border border-[var(--m-rule)] bg-app-background px-3 py-2 font-lp-body text-[13px]" />
              {error && <p role="alert" className="font-lp-body text-[12.5px] text-app-rose">{error}</p>}
              <div className="flex gap-2">
                <button type="button" disabled={busy || note.trim().length < MIN_NOTE} onClick={() => apply(o.id)} className="rounded-full bg-app-charcoal px-4 py-1.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-50">{busy ? "Sending…" : "Send application"}</button>
                <button type="button" onClick={() => { setOpen(null); setError(null); }} className="rounded-full border border-[var(--m-rule)] bg-white px-4 py-1.5 font-lp-body text-[12.5px] font-semibold">Cancel</button>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => { setOpen(o.id); setError(null); }} className="mt-3 rounded-full bg-app-charcoal px-4 py-1.5 font-lp-body text-[12.5px] font-semibold text-white">Apply with my Passport</button>
          )}
        </li>
      ))}
    </ul>
  );
}
