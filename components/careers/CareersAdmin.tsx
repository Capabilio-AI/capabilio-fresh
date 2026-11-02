"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { postedLabel } from "@/lib/hiring/format";
import { APPLICATION_STATUSES, type ApplicationRow, type ApplicationStatus, type Opening, type OpeningStatus } from "@/lib/hiring/types";
import { OpeningForm } from "./OpeningForm";

const BTN = "rounded-full px-4 py-1.5 font-lp-body text-[12.5px] font-semibold disabled:opacity-50";
const BADGE: Record<OpeningStatus, string> = { draft: "bg-app-background text-app-muted", soon: "bg-[#e3e6fb] text-[#3a45c4]", open: "bg-[#dcf3e6] text-[#17784a]", closed: "bg-[#f1e4d6] text-[#a5560a]" };

/** Capabilio admin: post and close roles, and read what people send. */
export function CareersAdmin({ openings, applications, company = false }: { openings: Opening[]; applications: ApplicationRow[]; /** a company managing its own roles, not Capabilio managing /careers */ company?: boolean }) {
  const router = useRouter();
  const base = company ? "/api/company" : "/api/careers-admin";
  const [editing, setEditing] = useState<Opening | "new" | null>(null);
  const [filter, setFilter] = useState("all");
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function call(key: string, url: string, body: unknown) {
    setBusy(key);
    setError(null);
    const res = await fetch(url, { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(null);
    if (!res.ok) return setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "That didn't work.");
    router.refresh();
  }

  const counts = new Map<string | null, number>();
  for (const a of applications) counts.set(a.openingId, (counts.get(a.openingId) ?? 0) + 1);
  const shown = applications.filter((a) => filter === "all" || (filter === "intro" ? a.openingId === null : a.openingId === filter));

  return (
    <div className="flex flex-col gap-10">
      {error && <p role="alert" className="font-lp-body text-[12.5px] text-app-rose">{error}</p>}

      <section aria-label="Openings">
        <div className="flex items-center justify-between gap-3">
          <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Openings ({openings.length})</h2>
          {!editing && <button type="button" onClick={() => setEditing("new")} className={`${BTN} bg-app-charcoal text-white`}>New opening</button>}
        </div>
        {editing && <div className="mt-3"><OpeningForm company={company} key={editing === "new" ? "new" : editing.id} opening={editing === "new" ? undefined : editing} onDone={() => setEditing(null)} /></div>}
        {openings.length === 0 && !editing ? <p className="mt-3 font-lp-body text-[13px] text-app-muted">{company ? "No roles yet. Post one and signed-in students can see and apply to it as soon as its status is Open." : "No openings yet. Post one and it appears on /careers as soon as its status is Open."}</p> : (
          <ul className="mt-3 flex flex-col gap-3">
            {openings.map((o) => (
              <li key={o.id} className="rounded-2xl border border-[var(--m-rule)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{o.title} <span className={`ml-1.5 rounded-full px-2 py-0.5 text-[11px] font-semibold capitalize ${BADGE[o.status]}`}>{o.status}</span></p>
                    <p className="font-lp-body text-[12px] text-app-muted">{o.team} · {o.location} · {counts.get(o.id) ?? 0} applications{postedLabel(o.publishedAt) ? ` · ${postedLabel(o.publishedAt)}` : ""}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {!company && o.status !== "draft" && <Link href={`/careers/${o.slug}`} target="_blank" className={`${BTN} border border-[var(--m-rule)] bg-white text-[var(--m-ink)]`}>View page</Link>}
                    <button type="button" onClick={() => setEditing(o)} className={`${BTN} border border-[var(--m-rule)] bg-white text-[var(--m-ink)]`}>Edit</button>
                    {o.status === "open" ? (
                      <button type="button" disabled={busy !== null} onClick={() => call(o.id, `${base}/openings/${o.id}`, { status: "closed" })} className={`${BTN} border border-[var(--m-rule)] bg-white text-[var(--m-ink)]`}>Close</button>
                    ) : (
                      <button type="button" disabled={busy !== null} onClick={() => call(o.id, `${base}/openings/${o.id}`, { status: "open" })} className={`${BTN} bg-app-charcoal text-white`}>{o.status === "draft" ? "Publish" : o.status === "soon" ? "Open now" : "Reopen"}</button>
                    )}
                  </div>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section aria-label="Applications">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Applications ({shown.length})</h2>
          <select aria-label="Filter applications" value={filter} onChange={(e) => setFilter(e.target.value)} className="rounded-lg border border-[var(--m-rule)] bg-white px-3 py-1.5 font-lp-body text-[12.5px]">
            <option value="all">All roles</option>
            <option value="intro">Open introductions</option>
            {openings.map((o) => <option key={o.id} value={o.id}>{o.title}</option>)}
          </select>
        </div>
        {shown.length === 0 ? <p className="mt-3 font-lp-body text-[13px] text-app-muted">Nothing here yet.</p> : (
          <ul className="mt-3 flex flex-col gap-3">
            {shown.map((a) => (
              <li key={a.id} className="rounded-2xl border border-[var(--m-rule)] bg-white p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{a.fullName} <a href={`mailto:${a.email}`} className="font-normal text-app-muted hover:underline">{a.email}</a></p>
                    <p className="font-lp-body text-[12px] text-app-muted">{a.openingTitle ?? "Open introduction"} · {new Date(a.createdAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</p>
                  </div>
                  <select aria-label={`Status for ${a.fullName}`} value={a.status} disabled={busy === a.id} onChange={(e) => call(a.id, `${base}/applications/${a.id}`, { status: e.target.value as ApplicationStatus })} className="rounded-lg border border-[var(--m-rule)] bg-white px-3 py-1.5 font-lp-body text-[12.5px] capitalize">
                    {APPLICATION_STATUSES.map((s) => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
                <p className="mt-3 font-lp-body text-[13px] text-[var(--m-ink)]">{a.passportCode && <><Link href={`/passport/${a.passportCode}`} target="_blank" className="font-semibold underline">Skill Passport</Link> · </>}<a href={a.workUrl} target="_blank" rel="noopener noreferrer" className="font-semibold underline">Their work</a>{a.resumeUrl && <> · <a href={a.resumeUrl} target="_blank" rel="noopener noreferrer" className="underline">Resume</a></>}{a.profileUrl && <> · <a href={a.profileUrl} target="_blank" rel="noopener noreferrer" className="underline">Profile</a></>}</p>
                <p className="mt-2 whitespace-pre-wrap rounded-lg bg-app-background px-3 py-2 font-lp-body text-[13px] text-[var(--m-ink)]">{a.proofNote}</p>
                <input defaultValue={a.internalNote ?? ""} maxLength={2000} placeholder="Private note" aria-label={`Private note for ${a.fullName}`} onBlur={(e) => e.target.value.trim() !== (a.internalNote ?? "") && call(a.id, `${base}/applications/${a.id}`, { internalNote: e.target.value.trim() || null })} className="mt-3 w-full rounded-lg border border-[var(--m-rule)] bg-app-background px-3 py-2 font-lp-body text-[13px]" />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
