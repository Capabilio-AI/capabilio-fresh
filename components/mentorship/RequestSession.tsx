"use client";

import { useEffect, useId, useMemo, useState } from "react";
import clsx from "clsx";
import { CalendarClock, Loader2 } from "lucide-react";
import { hm, toZoned } from "@/lib/mentorship/grid";
import { validateRequest } from "@/lib/mentorship/rules";

const FIELD = "w-full rounded-lg border border-[var(--m-rule)] bg-white px-3 py-2 font-lp-body text-[13px] text-[var(--m-ink)] focus:border-[var(--m-ink)] focus:outline-none";
const DAY = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

interface Slot { id: string; startsAt: string; endsAt: string }
interface Offer { slots: Slot[]; timezone: string; sessionMinutes: number }

/** Book one of a mentor's open times. The mentor gets an alert and approves it; until then the time is held for you. */
export function RequestSession({ mentorId, mentorName }: { mentorId: string; mentorName: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  const [offer, setOffer] = useState<Offer | null | "none">(null);
  const [day, setDay] = useState<string | null>(null);
  const [slotId, setSlotId] = useState<string | null>(null);
  const [topic, setTopic] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [sent, setSent] = useState(false);

  useEffect(() => {
    if (!open || offer !== null) return;
    let alive = true;
    (async () => {
      try {
        const res = await fetch(`/api/mentorship/mentors/${mentorId}/slots`);
        if (!res.ok) throw new Error("none");
        const json = (await res.json()) as Offer;
        if (alive) setOffer(json.slots.length ? json : "none");
      } catch {
        if (alive) setOffer("none");
      }
    })();
    return () => { alive = false; };
  }, [open, offer, mentorId]);

  const days = useMemo(() => {
    if (!offer || offer === "none") return [];
    const m = new Map<string, { slot: Slot; minutes: number }[]>();
    for (const s of offer.slots) {
      const z = toZoned(s.startsAt, offer.timezone);
      m.set(z.key, [...(m.get(z.key) ?? []), { slot: s, minutes: z.minutes }]);
    }
    return [...m];
  }, [offer]);
  const chosenDay = day ?? days[0]?.[0] ?? null;

  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = { mentorId, slotId, topic, message };
    const check = validateRequest(body);
    if (!check.ok) return setMsg(check.error);
    setBusy(true);
    setMsg(null);
    try {
      const res = await fetch("/api/mentorship/requests", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
      const json = (await res.json().catch(() => ({}))) as { error?: string };
      if (!res.ok) {
        if (res.status === 409) setOffer(null);
        throw new Error(json.error ?? "Could not send your request. Try again.");
      }
      setSent(true);
      setOpen(false);
    } catch (err) {
      setMsg(err instanceof Error ? err.message : "Could not send your request. Try again.");
    } finally {
      setBusy(false);
    }
  };

  if (sent) return <p role="status" className="font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">Requested. {mentorName.split(" ")[0]} will approve it and you will see the link under Your session requests.</p>;
  if (!open) return <button type="button" onClick={() => setOpen(true)} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[12.5px] font-semibold text-white"><CalendarClock size={13} aria-hidden="true" />Book a session</button>;
  if (offer === null) return <p role="status" className="inline-flex items-center gap-2 font-lp-body text-[12.5px] text-app-muted"><Loader2 size={13} className="animate-spin" aria-hidden="true" />Loading times</p>;
  if (offer === "none") return <p role="status" className="font-lp-body text-[12.5px] text-app-muted">{mentorName.split(" ")[0]} has no open times right now. Check back soon. <button type="button" onClick={() => setOpen(false)} className="font-semibold underline">Close</button></p>;

  return (
    <form onSubmit={send} className="grid w-full gap-3" aria-label={`Book a session with ${mentorName}`}>
      <fieldset>
        <legend className="mb-1 font-lp-body text-[12px] font-semibold text-[var(--m-ink)]">Choose a day ({offer.timezone}, {offer.sessionMinutes} minutes)</legend>
        <div className="flex flex-wrap gap-1.5">{days.slice(0, 14).map(([key]) => <button key={key} type="button" aria-pressed={chosenDay === key} onClick={() => { setDay(key); setSlotId(null); }} className={clsx("rounded-full border px-3 py-1 font-lp-body text-[12px] font-semibold", chosenDay === key ? "border-[var(--m-ink)] bg-[var(--m-ink)] text-white" : "border-[var(--m-rule)] text-[var(--m-ink)]")}>{DAY.format(new Date(`${key}T00:00:00Z`))}</button>)}</div>
      </fieldset>
      {chosenDay && (
        <fieldset>
          <legend className="mb-1 font-lp-body text-[12px] font-semibold text-[var(--m-ink)]">Choose a time</legend>
          <div className="flex flex-wrap gap-1.5">{(days.find(([k]) => k === chosenDay)?.[1] ?? []).map(({ slot, minutes }) => <button key={slot.id} type="button" aria-pressed={slotId === slot.id} onClick={() => setSlotId(slot.id)} className={clsx("rounded-lg border px-3 py-1.5 font-lp-body text-[12.5px] font-semibold tabular-nums", slotId === slot.id ? "border-[#8fd0a8] bg-[#d6f1df] text-[#1f6b3f]" : "border-[var(--m-rule)] text-[var(--m-ink)]")}>{hm(minutes)}</button>)}</div>
        </fieldset>
      )}
      <div><label htmlFor={`${id}-t`} className="mb-1 block font-lp-body text-[12px] font-semibold text-[var(--m-ink)]">What do you want help with?</label><input id={`${id}-t`} className={FIELD} value={topic} maxLength={120} onChange={(e) => setTopic(e.target.value)} placeholder="e.g. Preparing for system design interviews" /></div>
      <div><label htmlFor={`${id}-m`} className="mb-1 block font-lp-body text-[12px] font-semibold text-[var(--m-ink)]">Tell {mentorName.split(" ")[0]} more</label><textarea id={`${id}-m`} rows={3} className={`${FIELD} resize-y`} value={message} maxLength={1000} onChange={(e) => setMessage(e.target.value)} placeholder="Where you are now and what you hope to get from the session." /></div>
      <div className="flex items-center gap-2">
        <button type="submit" disabled={busy || !slotId} className="inline-flex items-center gap-1.5 rounded-full bg-[var(--m-ink)] px-4 py-2 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-50">{busy && <Loader2 size={13} className="animate-spin" aria-hidden="true" />}Request this time</button>
        <button type="button" onClick={() => setOpen(false)} className="px-3 py-2 font-lp-body text-[12.5px] font-semibold text-app-muted">Cancel</button>
      </div>
      <p role="alert" className="min-h-[1rem] font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">{msg}</p>
    </form>
  );
}
