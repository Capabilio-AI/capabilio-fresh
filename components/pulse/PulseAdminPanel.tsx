"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import type { MentorApplicationRow } from "@/lib/pulse/mentors";
import type { ReportItem } from "@/lib/pulse/moderation";
import { relativeTime } from "@/lib/pulse/format";
import { Avatar } from "./Avatar";

const BTN = "rounded-full px-4 py-1.5 font-lp-body text-[12.5px] font-semibold disabled:opacity-50";

/** Capabilio admin: review mentor applications and handle reports. */
export function PulseAdminPanel({ applications, reports }: { applications: MentorApplicationRow[]; reports: ReportItem[] }) {
  const router = useRouter();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [notes, setNotes] = useState<Record<string, string>>({});

  async function call(key: string, url: string, body: unknown) {
    setBusy(key);
    setError(null);
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) return setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.");
    router.refresh();
  }

  return (
    <div className="flex flex-col gap-10">
      {error && <p role="alert" className="font-lp-body text-[12.5px] text-app-rose">{error}</p>}

      <section aria-label="Mentor applications">
        <h2 className="font-lp-display text-[17px] font-semibold text-app-charcoal">Mentor applications ({applications.length})</h2>
        {applications.length === 0 ? <p className="mt-3 font-lp-body text-[13px] text-app-muted">No applications waiting.</p> : (
          <ul className="mt-3 flex flex-col gap-4">
            {applications.map((a) => (
              <li key={a.id} className="rounded-2xl border border-app-border bg-white p-5">
                <div className="flex items-start gap-3">
                  <Avatar person={a} size="md" />
                  <div className="min-w-0 flex-1">
                    <Link href={`/pulse/u/${a.id}`} className="font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">{a.name}</Link>
                    <p className="font-lp-body text-[12px] text-app-muted">{a.headline ?? "No college on record"} · submitted {relativeTime(a.submittedAt)} ago</p>
                  </div>
                </div>
                <p className="mt-3 font-lp-body text-[13.5px] font-medium text-app-charcoal">{a.application.headline}</p>
                <p className="mt-1 whitespace-pre-wrap font-lp-body text-[13px] text-app-charcoal">{a.application.bio}</p>
                <p className="mt-2 font-lp-body text-[12px] text-app-muted">{[a.application.roleTitle, a.application.company].filter(Boolean).join(" at ")}{a.application.yearsExperience != null ? ` · ${a.application.yearsExperience} years` : ""} · {a.application.expertise.join(", ")}</p>
                <input value={notes[a.id] ?? ""} onChange={(e) => setNotes((n) => ({ ...n, [a.id]: e.target.value.slice(0, 500) }))} placeholder="Note to the applicant (shown if rejected)" aria-label={`Note for ${a.name}`} className="mt-3 w-full rounded-lg border border-app-border bg-app-background px-3 py-2 font-lp-body text-[13px]" />
                <div className="mt-3 flex gap-2">
                  <button type="button" disabled={busy !== null} onClick={() => call(a.id, `/api/pulse-admin/mentors/${a.id}`, { decision: "approve", note: notes[a.id] || undefined })} className={`${BTN} flex items-center gap-1.5 bg-app-charcoal text-white`}><Check size={13} aria-hidden="true" /> Approve</button>
                  <button type="button" disabled={busy !== null} onClick={() => call(a.id, `/api/pulse-admin/mentors/${a.id}`, { decision: "reject", note: notes[a.id] || undefined })} className={`${BTN} flex items-center gap-1.5 border border-app-border bg-white text-app-charcoal`}><X size={13} aria-hidden="true" /> Reject</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Reports">
        <h2 className="font-lp-display text-[17px] font-semibold text-app-charcoal">Open reports ({reports.length})</h2>
        {reports.length === 0 ? <p className="mt-3 font-lp-body text-[13px] text-app-muted">No open reports.</p> : (
          <ul className="mt-3 flex flex-col gap-3">
            {reports.map((r) => (
              <li key={r.id} className="rounded-2xl border border-app-border bg-white p-4">
                <p className="font-lp-body text-[13px] text-app-charcoal"><span className="font-semibold capitalize">{r.targetType.replace("_", " ")}</span> reported for <span className="font-semibold">{r.reason}</span> by {r.reporter} · {relativeTime(r.createdAt)} ago</p>
                {r.excerpt && <p className="mt-2 whitespace-pre-wrap rounded-lg bg-app-background px-3 py-2 font-lp-body text-[13px] text-app-charcoal">{r.excerpt}</p>}
                {r.details && <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">“{r.details}”</p>}
                <div className="mt-3 flex flex-wrap items-center gap-2">
                  {r.profileId && <Link href={`/pulse/u/${r.profileId}`} className={`${BTN} border border-app-border text-app-charcoal`}>Open profile</Link>}
                  <button type="button" disabled={busy !== null} onClick={() => call(r.id, `/api/pulse-admin/reports/${r.id}`, { status: "reviewed" })} className={`${BTN} bg-app-charcoal text-white`}>Mark reviewed</button>
                  <button type="button" disabled={busy !== null} onClick={() => call(r.id, `/api/pulse-admin/reports/${r.id}`, { status: "dismissed" })} className={`${BTN} border border-app-border text-app-muted`}>Dismiss</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
