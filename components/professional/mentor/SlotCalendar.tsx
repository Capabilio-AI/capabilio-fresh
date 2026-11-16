"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { ChevronLeft, ChevronRight, Loader2, X } from "lucide-react";
import { dayStarts, hm, lastBookableDay, monthGrid, toZoned } from "@/lib/mentorship/grid";
import type { SlotView } from "@/lib/mentorship/server";

const WEEK = ["M", "T", "W", "T", "F", "S", "S"];
const MONTH = new Intl.DateTimeFormat("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });
const LONG = new Intl.DateTimeFormat("en-IN", { weekday: "long", day: "numeric", month: "long", timeZone: "UTC" });
const SHORT = new Intl.DateTimeFormat("en-IN", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });

async function put(date: string, starts: number[]): Promise<string | null> {
  try {
    const res = await fetch("/api/professional/mentor/slots", { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ date, starts }) });
    if (res.ok) return null;
    return ((await res.json().catch(() => ({}))) as { error?: string }).error ?? "That did not save. Try again.";
  } catch {
    return "Could not reach the server. Try again.";
  }
}

/**
 * A small month calendar. Pick a date and a window lists the times for that day: tap a time to open it (green) or close it (red), then save.
 * Times someone has asked for, or that are booked, are shown dark and cannot be changed here.
 */
export function SlotCalendar({ slots, timezone, sessionMinutes }: { slots: SlotView[]; timezone: string; sessionMinutes: number }) {
  const router = useRouter();
  const dialog = useRef<HTMLDialogElement>(null);
  const [today] = useState(() => toZoned(new Date(), timezone).key);
  const [ym, setYm] = useState(() => ({ y: Number(today.slice(0, 4)), m: Number(today.slice(5, 7)) }));
  const [day, setDay] = useState<string | null>(null);
  const [picked, setPicked] = useState<Set<number>>(new Set());
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  const last = useMemo(() => lastBookableDay(new Date(), timezone), [timezone]);
  const byDay = useMemo(() => {
    const m = new Map<string, { slot: SlotView; minutes: number }[]>();
    for (const s of slots) {
      const z = toZoned(s.startsAt, timezone);
      m.set(z.key, [...(m.get(z.key) ?? []), { slot: s, minutes: z.minutes }]);
    }
    return m;
  }, [slots, timezone]);
  const weeks = useMemo(() => monthGrid(ym.y, ym.m, timezone, new Date()), [ym, timezone]);
  const starts = useMemo(() => dayStarts(sessionMinutes), [sessionMinutes]);
  const nowMinutes = toZoned(new Date(), timezone).minutes;

  useEffect(() => {
    const d = dialog.current;
    if (!d) return;
    if (day && !d.open) d.showModal();
    if (!day && d.open) d.close();
  }, [day]);

  const open = (key: string) => {
    setDay(key);
    setPicked(new Set((byDay.get(key) ?? []).filter((x) => x.slot.status === "open").map((x) => x.minutes)));
    setMsg(null);
  };
  const toggle = (m: number) => setPicked((p) => { const n = new Set(p); if (n.has(m)) n.delete(m); else n.add(m); return n; });
  const save = async () => {
    if (!day) return;
    setBusy(true);
    setMsg(null);
    const err = await put(day, [...picked]);
    setBusy(false);
    if (err) return setMsg(err);
    setDay(null);
    router.refresh();
  };
  const removeOne = async (s: SlotView) => {
    const z = toZoned(s.startsAt, timezone);
    const rest = (byDay.get(z.key) ?? []).filter((x) => x.slot.status === "open" && x.slot.id !== s.id).map((x) => x.minutes);
    const err = await put(z.key, rest);
    if (err) setMsg(err);
    router.refresh();
  };

  const prevOk = ym.y > Number(today.slice(0, 4)) || ym.m > Number(today.slice(5, 7));
  const nextOk = `${ym.m === 12 ? ym.y + 1 : ym.y}-${String(ym.m === 12 ? 1 : ym.m + 1).padStart(2, "0")}-01` <= last;
  const step = (d: number) => setYm((c) => { const t = c.y * 12 + (c.m - 1) + d; return { y: Math.floor(t / 12), m: (t % 12) + 1 }; });
  const upcoming = slots.slice(0, 8);
  const taken = new Map((day ? byDay.get(day) ?? [] : []).filter((x) => x.slot.status !== "open").map((x) => [x.minutes, x.slot]));

  return (
    <div className="grid items-start gap-6 md:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
      <div className="rounded-2xl border border-[var(--m-rule)] p-4">
        <div className="flex items-center justify-between">
          <button type="button" onClick={() => step(-1)} disabled={!prevOk} aria-label="Previous month" className="grid size-8 place-items-center rounded-full border border-[var(--m-rule)] disabled:opacity-40"><ChevronLeft size={15} aria-hidden /></button>
          <p className="text-[14px] font-bold text-[var(--m-ink)]" aria-live="polite">{MONTH.format(new Date(Date.UTC(ym.y, ym.m - 1, 1)))}</p>
          <button type="button" onClick={() => step(1)} disabled={!nextOk} aria-label="Next month" className="grid size-8 place-items-center rounded-full border border-[var(--m-rule)] disabled:opacity-40"><ChevronRight size={15} aria-hidden /></button>
        </div>
        <div className="mt-3 grid grid-cols-7 gap-1 text-center text-[11.5px] font-bold text-[var(--m-muted)]" aria-hidden>{WEEK.map((w, i) => <span key={i}>{w}</span>)}</div>
        <div className="mt-1 grid grid-cols-7 gap-1">
          {weeks.flat().map((c) => {
            const list = byDay.get(c.key) ?? [];
            const openN = list.filter((x) => x.slot.status === "open").length;
            const askN = list.filter((x) => x.slot.status === "requested").length;
            const bookN = list.filter((x) => x.slot.status === "booked").length;
            const disabled = c.past || c.key > last || !c.inMonth;
            return (
              <button key={c.key} type="button" disabled={disabled} onClick={() => open(c.key)} aria-label={`${LONG.format(new Date(`${c.key}T00:00:00Z`))}: ${openN} open, ${askN} waiting for your answer, ${bookN} booked`} className={clsx("relative grid h-9 place-items-center rounded-lg text-[13px] font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-[var(--m-ink)]", disabled ? "text-[var(--m-off)]" : "text-[var(--m-ink)] hover:bg-[var(--m-ground)]", c.today && "ring-2 ring-[var(--m-accent)]", openN > 0 && !disabled && "bg-[#d6f1df]")}>
                {c.inMonth ? c.day : ""}
                {!disabled && (askN > 0 || bookN > 0) && <span aria-hidden className={clsx("absolute bottom-0.5 size-1.5 rounded-full", askN > 0 ? "bg-[var(--m-accent)]" : "bg-[var(--m-ink)]")} />}
              </button>
            );
          })}
        </div>
        <ul aria-label="Colour key" className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-[11.5px] text-[var(--m-muted)]">
          <li className="flex items-center gap-1.5"><span aria-hidden className="size-3 rounded bg-[#d6f1df] ring-1 ring-[#8fd0a8]" />Has open slots</li>
          <li className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-[var(--m-accent)]" />Waiting for you</li>
          <li className="flex items-center gap-1.5"><span aria-hidden className="size-1.5 rounded-full bg-[var(--m-ink)]" />Booked</li>
        </ul>
      </div>

      <div>
        <h3 className="text-[13px] font-bold uppercase tracking-wide text-[var(--m-muted)]">Coming up</h3>
        {upcoming.length === 0 ? <p className="mt-2 text-[14px] text-[var(--m-muted)]">No slots yet. Pick a date on the calendar and choose the times you are free.</p> : (
          <ul className="mt-2 divide-y divide-[var(--m-rule)]">
            {upcoming.map((s) => {
              const z = toZoned(s.startsAt, timezone);
              return (
                <li key={s.id} className="flex items-center justify-between gap-3 py-2.5 text-[14px]">
                  <div className="min-w-0"><p className="font-bold text-[var(--m-ink)]">{SHORT.format(new Date(`${z.key}T00:00:00Z`))}, {hm(z.minutes)} to {hm(z.minutes + sessionMinutes)}</p>{s.label && <p className="truncate text-[12.5px] text-[var(--m-muted)]">{s.label}</p>}</div>
                  {s.status === "open" ? (
                    <span className="flex items-center gap-2"><span className="rounded-full bg-[#d6f1df] px-2.5 py-0.5 text-[11.5px] font-bold text-[#1f6b3f]">Open</span><button type="button" onClick={() => removeOne(s)} aria-label={`Remove the ${hm(z.minutes)} slot on ${SHORT.format(new Date(`${z.key}T00:00:00Z`))}`} className="grid size-7 place-items-center rounded-full text-[var(--m-muted)] hover:bg-[var(--m-ground)] hover:text-[var(--m-ink)]"><X size={14} aria-hidden /></button></span>
                  ) : <span className={clsx("rounded-full px-2.5 py-0.5 text-[11.5px] font-bold", s.status === "requested" ? "bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]" : "bg-[var(--m-ink)] text-white")}>{s.status === "requested" ? "Needs your answer" : "Booked"}</span>}
                </li>
              );
            })}
          </ul>
        )}
        {slots.length > upcoming.length && <p className="mt-2 text-[12.5px] text-[var(--m-muted)]">And {slots.length - upcoming.length} more later on.</p>}
        <p role="status" className="mt-2 min-h-[1rem] text-[13px] text-[var(--m-muted)]">{day ? null : msg}</p>
      </div>

      <dialog ref={dialog} onClose={() => setDay(null)} aria-labelledby="slot-day-h" className="m-auto w-[min(92vw,420px)] rounded-3xl border border-[var(--m-rule)] bg-white p-0 text-[var(--m-ink)] backdrop:bg-black/40">
        {day && (
          <form method="dialog" onSubmit={(e) => { e.preventDefault(); void save(); }} className="p-5">
            <div className="flex items-start justify-between gap-3">
              <div><h3 id="slot-day-h" className="font-lp-display text-[18px] font-bold">{LONG.format(new Date(`${day}T00:00:00Z`))}</h3><p className="text-[12.5px] text-[var(--m-muted)]">{sessionMinutes}-minute sessions · {timezone}. Tap a time to open it.</p></div>
              <button type="button" onClick={() => setDay(null)} aria-label="Close" className="grid size-8 place-items-center rounded-full hover:bg-[var(--m-ground)]"><X size={16} aria-hidden /></button>
            </div>
            <ul className="mt-4 grid max-h-[46vh] grid-cols-3 gap-2 overflow-y-auto pr-1">
              {starts.map((m) => {
                const t = taken.get(m);
                const past = day === today && m < nowMinutes + 30;
                const on = picked.has(m);
                if (t) return <li key={m}><span title={t.label ?? undefined} className={clsx("block rounded-lg px-2 py-2 text-center text-[13px] font-bold", t.status === "requested" ? "bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]" : "bg-[var(--m-ink)] text-white")}>{hm(m)}<span className="block text-[10.5px] font-medium">{t.status === "requested" ? "Waiting" : "Booked"}</span></span></li>;
                return <li key={m}><button type="button" disabled={past} aria-pressed={on} onClick={() => toggle(m)} className={clsx("w-full rounded-lg border px-2 py-2 text-center text-[13px] font-bold tabular-nums focus-visible:outline-2 focus-visible:outline-[var(--m-ink)] disabled:cursor-not-allowed disabled:opacity-40", on ? "border-[#8fd0a8] bg-[#d6f1df] text-[#1f6b3f]" : "border-[#f3cccc] bg-[#fbe4e4] text-[#8a2f2f]")}>{hm(m)}<span className="block text-[10.5px] font-medium">{on ? "Open" : "No slot"}</span></button></li>;
              })}
            </ul>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="submit" disabled={busy} className="inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white hover:bg-[var(--m-accent-ink)] disabled:opacity-45">{busy && <Loader2 size={15} className="animate-spin" aria-hidden />}Save</button>
              <button type="button" onClick={() => setPicked(new Set())} className="text-[13px] font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)]">Clear the day</button>
              <p role="alert" className="w-full text-[13px] font-bold text-[var(--m-ink)]">{msg}</p>
            </div>
          </form>
        )}
      </dialog>
    </div>
  );
}
