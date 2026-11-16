"use client";

import { useId, useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarPlus, ExternalLink, Star } from "lucide-react";
import type { RequestView } from "@/lib/mentorship/server";

const FIELD = "w-full rounded-xl border border-[var(--m-soft)] bg-white px-3 py-2 text-[14px] text-[var(--m-ink)] focus:border-[var(--m-ink)] focus:outline-none";
const PATH_LABEL = { student: "Student", graduate: "Recently graduated", professional: "Professional" } as const;

async function respond(requestId: string, body: unknown): Promise<string | null> {
  try {
    const res = await fetch(`/api/professional/mentor/requests/${requestId}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not save. Try again.";
  } catch {
    return "Could not reach the server. Try again.";
  }
}

/** Requests from mentees: answer new ones, run upcoming sessions, and look back at finished ones. */
export function RequestsInbox({ requests, timezone, sessionMinutes }: { requests: RequestView[]; timezone: string; sessionMinutes: number }) {
  const id = useId();
  const router = useRouter();
  const [open, setOpen] = useState<{ id: string; mode: "accept" | "decline" } | null>(null);
  const [when, setWhen] = useState("");
  const [link, setLink] = useState("");
  const [note, setNote] = useState("");
  const [msg, setMsg] = useState<{ id: string; text: string } | null>(null);
  const at = (iso: string) => new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", timeZone: timezone, timeZoneName: "short" }).format(new Date(iso));

  const run = async (r: RequestView, body: unknown) => {
    const err = await respond(r.id, body);
    if (err) return setMsg({ id: r.id, text: err });
    setOpen(null);
    setMsg(null);
    router.refresh();
  };
  const groups = [
    { key: "new", title: "New requests", list: requests.filter((r) => r.status === "requested") },
    { key: "up", title: "Upcoming sessions", list: requests.filter((r) => r.status === "accepted") },
    { key: "past", title: "Earlier", list: requests.filter((r) => r.status === "completed" || r.status === "declined" || r.status === "cancelled") },
  ];
  if (requests.length === 0) return <p className="text-[14.5px] text-[var(--m-muted)]">No requests yet. They appear here as soon as a mentee asks for a session.</p>;

  return (
    <div className="flex flex-col gap-6">
      {groups.filter((g) => g.list.length).map((g) => (
        <section key={g.key} aria-label={g.title}>
          <h3 className="text-[13px] font-bold uppercase tracking-wide text-[var(--m-muted)]">{g.title} ({g.list.length})</h3>
          <ul className="mt-2 flex flex-col gap-3">
            {g.list.map((r) => (
              <li key={r.id} className="rounded-2xl border border-[var(--m-rule)] p-5">
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0"><p className="text-[15px] font-bold text-[var(--m-ink)]">{r.topic}</p><p className="text-[13px] text-[var(--m-muted)]">{r.mentee.name} · {PATH_LABEL[r.mentee.path]}</p></div>
                  {r.status !== "requested" && r.status !== "accepted" && <span className="rounded-full bg-[var(--m-ground)] px-2.5 py-1 text-[11.5px] font-bold capitalize text-[var(--m-muted)]">{r.status}</span>}
                </div>
                <p className="mt-2 whitespace-pre-wrap break-words text-[14px] text-[var(--m-ink)]">{r.message}</p>
                {r.preferred && <p className="mt-1 text-[13px] text-[var(--m-muted)]">Preferred times: {r.preferred}</p>}
                {r.status === "requested" && r.startsAt && <p className="mt-2 rounded-xl bg-[var(--m-ground)] px-3 py-2 text-[13.5px] font-bold text-[var(--m-ink)]">Requested slot: {at(r.startsAt)}</p>}

                {r.status === "accepted" && r.startsAt && r.meetingUrl && (
                  <div className="mt-3 rounded-xl bg-[var(--m-ground)] p-3 text-[13.5px] text-[var(--m-ink)]">
                    <p className="font-bold">{at(r.startsAt)}</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <a href={r.meetingUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-ink)] px-4 py-1.5 text-[12.5px] font-bold text-white">Join<ExternalLink size={13} aria-hidden /></a>
                      <a href={`/api/mentorship/requests/${r.id}/ics`} className="inline-flex items-center gap-1.5 rounded-full border border-[var(--m-rule)] bg-white px-4 py-1.5 text-[12.5px] font-bold text-[var(--m-ink)]"><CalendarPlus size={13} aria-hidden />Add to calendar</a>
                    </div>
                  </div>
                )}
                {r.status === "declined" && r.declineNote && <p className="mt-2 text-[13px] text-[var(--m-muted)]">Your note: {r.declineNote}</p>}
                {r.rating && <p className="mt-2 flex items-center gap-1.5 text-[13.5px] text-[var(--m-ink)]"><Star size={14} className="fill-current" aria-hidden /><span className="font-bold">{r.rating.stars} of 5</span>{r.rating.comment && <span className="text-[var(--m-muted)]">· {r.rating.comment}</span>}</p>}

                {r.status === "requested" && (
                  <div className="mt-3">
                    {open?.id === r.id && open.mode === "accept" ? (
                      <div className="grid gap-3 sm:grid-cols-2">
                        {!r.startsAt && <div><label htmlFor={`${id}-w${r.id}`} className="mb-1 block text-[12.5px] font-bold text-[var(--m-ink)]">Date and time ({sessionMinutes} minutes)</label><input id={`${id}-w${r.id}`} type="datetime-local" className={FIELD} value={when} onChange={(e) => setWhen(e.target.value)} /></div>}
                        <div className={r.startsAt ? "sm:col-span-2" : undefined}><label htmlFor={`${id}-l${r.id}`} className="mb-1 block text-[12.5px] font-bold text-[var(--m-ink)]">Meeting link for the session</label><input id={`${id}-l${r.id}`} type="url" className={FIELD} value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://meet.google.com/…" /></div>
                        <div className="flex gap-2 sm:col-span-2"><button type="button" onClick={() => run(r, { action: "accept", startsAt: !r.startsAt && when ? new Date(when).toISOString() : undefined, meetingUrl: link })} className="rounded-full bg-[var(--m-ink)] px-5 py-2 text-[13px] font-bold text-white">Approve and confirm</button><button type="button" onClick={() => setOpen(null)} className="rounded-full px-4 py-2 text-[13px] font-bold text-[var(--m-muted)]">Back</button></div>
                      </div>
                    ) : open?.id === r.id && open.mode === "decline" ? (
                      <div className="grid gap-3">
                        <div><label htmlFor={`${id}-n${r.id}`} className="mb-1 block text-[12.5px] font-bold text-[var(--m-ink)]">A short note for them (optional)</label><input id={`${id}-n${r.id}`} className={FIELD} value={note} maxLength={300} onChange={(e) => setNote(e.target.value)} /></div>
                        <div className="flex gap-2"><button type="button" onClick={() => run(r, { action: "decline", note })} className="rounded-full bg-[var(--m-ink)] px-5 py-2 text-[13px] font-bold text-white">Decline request</button><button type="button" onClick={() => setOpen(null)} className="rounded-full px-4 py-2 text-[13px] font-bold text-[var(--m-muted)]">Back</button></div>
                      </div>
                    ) : (
                      <div className="flex gap-2"><button type="button" onClick={() => { setOpen({ id: r.id, mode: "accept" }); setMsg(null); }} className="rounded-full bg-[var(--m-ink)] px-5 py-2 text-[13px] font-bold text-white">Approve</button><button type="button" onClick={() => { setOpen({ id: r.id, mode: "decline" }); setMsg(null); }} className="rounded-full border border-[var(--m-rule)] px-5 py-2 text-[13px] font-bold text-[var(--m-ink)]">Decline</button></div>
                    )}
                  </div>
                )}
                {r.status === "accepted" && (
                  <div className="mt-3 flex gap-2">
                    {r.startsAt && Date.parse(r.startsAt) <= Date.now() && <button type="button" onClick={() => run(r, { action: "complete" })} className="rounded-full bg-[var(--m-ink)] px-5 py-2 text-[13px] font-bold text-white">Mark complete</button>}
                    <button type="button" onClick={() => run(r, { action: "cancel" })} className="rounded-full border border-[var(--m-rule)] px-5 py-2 text-[13px] font-bold text-[var(--m-ink)]">Cancel session</button>
                  </div>
                )}
                {msg?.id === r.id && <p role="alert" className="mt-2 text-[13px] font-bold text-[var(--m-ink)]">{msg.text}</p>}
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}
