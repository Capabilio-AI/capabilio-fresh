"use client";

import { useEffect, useState } from "react";
import { CalendarClock, CheckCircle2, Loader2, Lock, PlayCircle, Timer } from "lucide-react";
import { mockOf } from "@/lib/crt/mocks";
import { MODULE_LABEL, CRT_MODULES } from "@/lib/crt/model";
import { negativeMarkingNote } from "@/lib/crt/marking";
import type { StudentCycle } from "@/lib/crt/server";
import { formatWhen } from "./api";

const REFRESH_MS = 15_000;

type Phase = "upcoming" | "open" | "closed";
const phaseAt = (c: StudentCycle, now: number): Phase => (now < Date.parse(c.opensAt) ? "upcoming" : now > Date.parse(c.closesAt) ? "closed" : "open");

function Mock({ c, now, onStart, busy }: { c: StudentCycle; now: number; onStart: (id: string) => void; busy: boolean }) {
  const mock = mockOf(c.mockKey);
  const phase = phaseAt(c, now);
  const done = Boolean(c.result);
  const startable = c.applies && phase === "open" && !done;
  return (
    <li className={`rounded-2xl border p-4 sm:p-5 ${startable ? "border-[var(--m-ink)] bg-white" : "border-app-border bg-[var(--m-ground)]"}`}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0 max-w-[60ch]">
          <p className="flex items-center gap-1.5 font-lp-body text-[12px] font-bold uppercase tracking-wide text-app-muted"><CalendarClock size={13} aria-hidden /> {formatWhen(c.opensAt)} to {formatWhen(c.closesAt)}</p>
          <h3 className="mt-1 font-lp-display text-[19px] font-bold text-app-charcoal">{c.title}</h3>
          <p className="font-lp-body text-[13px] text-app-muted">{mock?.label}</p>
          {mock && <p className="mt-2 font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">{mock.blurb}</p>}
          <p className="mt-2 inline-flex items-center gap-1.5 font-lp-body text-[12.5px] font-semibold text-app-charcoal"><Timer size={13} aria-hidden /> {c.questions} questions · {c.durationMinutes} minutes · one attempt</p>
          {mock && (
            <ul className="mt-2 flex flex-wrap gap-x-4 gap-y-1">
              {CRT_MODULES.filter((m) => mock.counts[m] > 0).map((m) => <li key={m} className="font-lp-body text-[12px] text-app-muted">{MODULE_LABEL[m]} <span className="tabular-nums text-app-charcoal">{mock.counts[m]}</span></li>)}
            </ul>
          )}
          {(startable || c.inProgress) && <p className="mt-2 font-lp-body text-[12px] text-app-muted">{negativeMarkingNote()} Your placement cell will see your score.</p>}
        </div>
        <div className="flex shrink-0 flex-col items-stretch gap-2 sm:items-end">
          {done && <span className="inline-flex items-center gap-1.5 rounded-full bg-[#e6f4ec] px-3.5 py-2 font-lp-body text-[13px] font-bold text-[#17784a]"><CheckCircle2 size={15} aria-hidden /> Completed · {c.result!.totalPct}%</span>}
          {!done && startable && (
            <button type="button" onClick={() => onStart(c.id)} disabled={busy} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--m-ink)] px-5 py-3 font-lp-body text-[14px] font-semibold text-white disabled:opacity-60">
              {busy ? <Loader2 size={16} className="animate-spin" aria-hidden /> : <PlayCircle size={16} aria-hidden />}
              {c.inProgress ? "Resume mock" : "Start mock"}
            </button>
          )}
          {!done && phase === "upcoming" && <span className="inline-flex items-center gap-1.5 rounded-xl border border-app-border bg-white px-4 py-3 font-lp-body text-[13px] font-semibold text-app-muted"><Lock size={14} aria-hidden /> Locked · opens {formatWhen(c.opensAt)}</span>}
          {!done && phase === "closed" && <span className="inline-flex items-center gap-1.5 rounded-xl border border-app-border bg-white px-4 py-3 font-lp-body text-[13px] font-semibold text-app-muted"><Lock size={14} aria-hidden /> Closed {formatWhen(c.closesAt)}</span>}
          {!done && phase === "open" && !c.applies && <span className="font-lp-body text-[12.5px] text-app-muted">Not for your branch or year</span>}
        </div>
      </div>
    </li>
  );
}

/** Full-length mocks the placement cell has scheduled. They are locked until the slot opens, can be started only while it is open, and are taken once. */
export function MockAssessments({ mocks, onStart, busy, error }: { mocks: StudentCycle[]; onStart: (id: string) => void; busy: boolean; error: string | null }) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    // unlocks a mock on its own when its slot starts, without a refresh
    const id = setInterval(() => setNow(Date.now()), REFRESH_MS);
    return () => clearInterval(id);
  }, []);
  return (
    <div>
      <h3 className="font-lp-display text-[17px] font-bold text-app-charcoal">Mock assessments</h3>
      <p className="mb-3 mt-0.5 max-w-[68ch] font-lp-body text-[13px] text-app-muted">Full-length mocks in the real exam format. They open only in the slot your placement cell sets, in the locked exam screen, and you take each one once.</p>
      {mocks.length === 0 ? (
        <div className="flex items-start gap-3 rounded-2xl border border-dashed border-app-border bg-[var(--m-ground)] p-4 sm:p-5">
          <Lock size={18} aria-hidden className="mt-0.5 shrink-0 text-app-muted" />
          <div>
            <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">No mock is scheduled</p>
            <p className="mt-0.5 font-lp-body text-[13px] text-app-muted">When your placement cell sets a slot it appears here, locked until it opens, and you are notified. Practise the sections below in the meantime.</p>
          </div>
        </div>
      ) : (
        <ul className="flex flex-col gap-3">{mocks.map((c) => <Mock key={c.id} c={c} now={now} onStart={onStart} busy={busy} />)}</ul>
      )}
      {error && <p role="alert" className="mt-3 font-lp-body text-[13px] text-app-warning">{error}</p>}
    </div>
  );
}
