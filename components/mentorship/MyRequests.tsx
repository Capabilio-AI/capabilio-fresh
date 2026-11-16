"use client";

import { useEffect, useState } from "react";
import { CalendarPlus, ExternalLink, Star } from "lucide-react";
import type { RequestView } from "@/lib/mentorship/server";

type Mine = Omit<RequestView, "mentee"> & { mentor: { id: string; name: string } };
const LABEL: Record<string, string> = { requested: "Waiting for an answer", accepted: "Confirmed", declined: "Declined", cancelled: "Cancelled", completed: "Completed" };

/** Your own session requests: what is waiting, what is confirmed (with the link and a calendar file), and a rating for finished ones. */
export function MyRequests() {
  const [rows, setRows] = useState<Mine[] | null>(null);
  const [stars, setStars] = useState<Record<string, number>>({});
  const [msg, setMsg] = useState<string | null>(null);

  const [version, setVersion] = useState(0);
  const reload = () => setVersion((v) => v + 1);

  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/mentorship/requests");
        if (!res.ok) throw new Error("load");
        const json = (await res.json()) as { requests: Mine[] };
        if (alive) setRows(json.requests);
      } catch {
        if (alive) setRows([]);
      }
    })();
    return () => { alive = false; };
  }, [version]);

  const act = async (url: string, init: RequestInit) => {
    const res = await fetch(url, init);
    if (!res.ok) setMsg(((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not save. Try again.");
    else setMsg(null);
    reload();
  };
  if (!rows || rows.length === 0) return null;
  const at = (iso: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }).format(new Date(iso));

  return (
    <section aria-labelledby="my-req-h" className="rounded-2xl border border-[var(--m-rule)] bg-white p-5">
      <h2 id="my-req-h" className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Your session requests</h2>
      <ul className="mt-3 divide-y divide-[var(--m-rule)]">
        {rows.map((r) => (
          <li key={r.id} className="py-3 first:pt-0 last:pb-0">
            <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{r.topic} <span className="font-normal text-app-muted">with {r.mentor.name}</span></p>
            <p className="font-lp-body text-[12.5px] text-app-muted">{LABEL[r.status]}{r.status === "accepted" && r.startsAt ? ` · ${at(r.startsAt)}` : ""}{r.status === "declined" && r.declineNote ? ` · "${r.declineNote}"` : ""}</p>
            {r.status === "accepted" && r.meetingUrl && (
              <div className="mt-2 flex flex-wrap gap-2">
                <a href={r.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-ink)] px-3.5 py-1.5 font-lp-body text-[12px] font-semibold text-white">Join<ExternalLink size={12} aria-hidden="true" /></a>
                <a href={`/api/mentorship/requests/${r.id}/ics`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--m-rule)] px-3.5 py-1.5 font-lp-body text-[12px] font-semibold text-[var(--m-ink)]"><CalendarPlus size={12} aria-hidden="true" />Add to calendar</a>
              </div>
            )}
            {(r.status === "requested" || r.status === "accepted") && <button type="button" onClick={() => act(`/api/mentorship/requests/${r.id}`, { method: "DELETE" })} className="mt-2 font-lp-body text-[12px] font-semibold text-app-muted underline">Cancel request</button>}
            {r.status === "completed" && (r.rating ? <p className="mt-1 flex items-center gap-1 font-lp-body text-[12.5px] text-[var(--m-ink)]"><Star size={13} className="fill-current" aria-hidden="true" />You rated {r.rating.stars} of 5</p> : (
              <div className="mt-2 flex flex-wrap items-center gap-1" role="group" aria-label="Rate this session">
                {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" aria-label={`${n} star${n === 1 ? "" : "s"}`} aria-pressed={stars[r.id] === n} onClick={() => setStars((s) => ({ ...s, [r.id]: n }))} className="p-0.5"><Star size={18} className={stars[r.id] >= n ? "fill-current text-[var(--m-ink)]" : "text-app-muted"} aria-hidden="true" /></button>)}
                <button type="button" disabled={!stars[r.id]} onClick={() => act(`/api/mentorship/requests/${r.id}/rating`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ stars: stars[r.id] }) })} className="ml-2 rounded-full bg-[var(--m-ink)] px-3.5 py-1.5 font-lp-body text-[12px] font-semibold text-white disabled:opacity-40">Submit rating</button>
              </div>
            ))}
          </li>
        ))}
      </ul>
      <p role="alert" className="mt-2 font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">{msg}</p>
    </section>
  );
}
