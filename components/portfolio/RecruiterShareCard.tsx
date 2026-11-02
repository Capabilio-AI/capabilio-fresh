"use client";

import { useState, useTransition } from "react";
import { Check, Copy, Send } from "lucide-react";
import { createRecruiterShare, revokeRecruiterShare } from "@/app/(app)/dashboard/portfolio/actions";
import { EXPIRY_CHOICES } from "@/lib/recruiter/share";
import type { ShareRow } from "@/lib/recruiter/shares";

export interface ShareableRecord {
  attemptId: string;
  title: string;
  area: string;
  sharedOnPortfolio: boolean;
}

const fmt = (iso: string) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const STATE_TEXT = { active: "Active", expired: "Expired", revoked: "Withdrawn" } as const;

/**
 * Owner-only. Create a link for one recruiter with exactly the work, expiry and contact details the student chooses, see how often it was opened, and
 * withdraw it. Records the student has hidden from the public portfolio stay unticked, but can be added here on purpose.
 */
export function RecruiterShareCard({ records, shares: initial, contactAvailable, origin }: { records: ShareableRecord[]; shares: ShareRow[]; contactAvailable: boolean; origin: string }) {
  const [shares, setShares] = useState(initial);
  const [label, setLabel] = useState("");
  const [picked, setPicked] = useState<Set<string>>(() => new Set(records.filter((r) => r.sharedOnPortfolio).map((r) => r.attemptId)));
  const [days, setDays] = useState<number>(30);
  const [contact, setContact] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState<string | null>(null);
  const [pending, start] = useTransition();

  const urlOf = (s: ShareRow) => `${origin}/r/${s.token}`;
  const toggle = (id: string) => setPicked((p) => { const n = new Set(p); if (n.has(id)) n.delete(id); else n.add(id); return n; });

  function create() {
    setError(null);
    start(async () => {
      const r = await createRecruiterShare({ label, attemptIds: [...picked], days, includeContact: contact && contactAvailable });
      if ("error" in r) return setError(r.error);
      setShares((s) => [r.share, ...s]);
      setLabel("");
      await navigator.clipboard.writeText(r.url).then(() => setCopied(r.share.id), () => undefined);
    });
  }

  function withdraw(id: string) {
    start(async () => {
      const r = await revokeRecruiterShare(id);
      if ("error" in r) return setError(r.error);
      setShares((s) => s.map((x) => (x.id === id ? { ...x, state: "revoked", revokedAt: new Date().toISOString() } : x)));
    });
  }

  if (records.length === 0) {
    return (
      <section className="rounded-xl border border-[var(--m-rule)] p-5 print:hidden">
        <h2 className="font-lp-body text-[15px] font-bold text-[var(--m-ink)]">Share with a recruiter</h2>
        <p className="mt-1 font-lp-body text-[13px] text-[var(--m-muted)]">Pass and explain an Arena task and it becomes a sealed work sample you can put in a link for a recruiter.</p>
      </section>
    );
  }

  return (
    <section className="rounded-xl border border-[var(--m-rule)] p-5 print:hidden" aria-labelledby="rs-h">
      <h2 id="rs-h" className="font-lp-body text-[15px] font-bold text-[var(--m-ink)]">Share with a recruiter</h2>
      <p className="mt-1 font-lp-body text-[13px] text-[var(--m-muted)]">Make a link for one recruiter. They see only the work you tick, until the date you choose, and you can withdraw it at any time. It works even if your public portfolio is off.</p>

      <label className="mt-4 block font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]">
        Who is it for?
        <input value={label} onChange={(e) => setLabel(e.target.value)} maxLength={80} placeholder="For example: Acme Analytics, campus drive" className="mt-1 w-full rounded-lg border border-[var(--m-rule)] bg-transparent px-3 py-2 font-lp-body text-[14px] font-normal" />
      </label>

      <fieldset className="mt-4">
        <legend className="font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]">Work to include</legend>
        <ul className="mt-1.5 flex max-h-56 flex-col gap-1 overflow-auto">
          {records.map((r) => (
            <li key={r.attemptId}>
              <label className="flex items-start gap-2 font-lp-body text-[13px] text-[var(--m-ink)]">
                <input type="checkbox" checked={picked.has(r.attemptId)} onChange={() => toggle(r.attemptId)} className="mt-1" />
                <span>{r.title} <span className="text-[var(--m-muted)]">· {r.area}{r.sharedOnPortfolio ? "" : " · hidden from your public portfolio"}</span></span>
              </label>
            </li>
          ))}
        </ul>
      </fieldset>

      <div className="mt-4 flex flex-wrap items-end gap-4">
        <label className="font-lp-body text-[12.5px] font-bold text-[var(--m-ink)]">
          Link works for
          <select value={days} onChange={(e) => setDays(Number(e.target.value))} className="mt-1 block rounded-lg border border-[var(--m-rule)] bg-transparent px-3 py-2 font-lp-body text-[14px] font-normal">
            {EXPIRY_CHOICES.map((d) => <option key={d} value={d}>{d} days</option>)}
          </select>
        </label>
        <label className={`flex items-center gap-2 font-lp-body text-[13px] ${contactAvailable ? "text-[var(--m-ink)]" : "text-[var(--m-muted)]"}`}>
          <input type="checkbox" checked={contact && contactAvailable} disabled={!contactAvailable} onChange={(e) => setContact(e.target.checked)} />
          Show my email and phone{contactAvailable ? "" : " (turn on contact sharing for your portfolio first)"}
        </label>
        <button type="button" onClick={create} disabled={pending || picked.size === 0} className="ml-auto inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[13px] font-bold text-[var(--m-ground)] disabled:opacity-50">
          <Send size={14} aria-hidden /> Create link
        </button>
      </div>
      {error && <p role="alert" className="mt-2 font-lp-body text-[13px] text-app-rose">{error}</p>}

      {shares.length > 0 && (
        <ul className="mt-5 flex flex-col divide-y divide-[var(--m-rule)] border-t border-[var(--m-rule)]">
          {shares.map((s) => (
            <li key={s.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
              <div className="min-w-0">
                <p className="font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{s.label} <span className="font-normal text-[var(--m-muted)]">· {STATE_TEXT[s.state]}</span></p>
                <p className="font-lp-body text-[12.5px] text-[var(--m-muted)]">{s.attemptIds.length} work sample{s.attemptIds.length === 1 ? "" : "s"} · until {fmt(s.expiresAt)} · opened {s.viewCount} time{s.viewCount === 1 ? "" : "s"}{s.lastViewedAt ? `, last ${fmt(s.lastViewedAt)}` : ""}</p>
              </div>
              {s.state === "active" && (
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => navigator.clipboard.writeText(urlOf(s)).then(() => setCopied(s.id))} className="inline-flex items-center gap-1 rounded-md px-2 py-1 font-lp-body text-[13px] font-bold text-[var(--m-accent-ink)] hover:bg-[var(--m-ground)]">
                    {copied === s.id ? <Check size={14} aria-hidden /> : <Copy size={14} aria-hidden />} {copied === s.id ? "Copied" : "Copy link"}
                  </button>
                  <button type="button" onClick={() => withdraw(s.id)} disabled={pending} className="rounded-md px-2 py-1 font-lp-body text-[13px] font-bold text-app-rose hover:bg-[var(--m-ground)] disabled:opacity-50">Withdraw</button>
                </div>
              )}
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
