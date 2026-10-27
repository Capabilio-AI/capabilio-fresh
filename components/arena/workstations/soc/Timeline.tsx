import { useMemo } from "react";
import { LOG_SOURCES, type LogLine, type PublicAlert } from "@/lib/workplace/soc/types";
import { bucketHistogram, hhmm, secOfDay, shiftSpan } from "./helpers";
import { FOCUS, H, PANEL, SOURCE_COLOR } from "./theme";

const BUCKETS = 32;
const BAR_H = 64;

interface Props {
  logs: LogLine[];
  matches: LogLine[];
  alerts: PublicAlert[];
  range: { from: number; to: number } | null;
  onRange: (r: { from: number; to: number } | null) => void;
}

/** Events per time bucket for the shift: faint bars are all lines, coloured stacks are the lines matching the current search. Click a bucket to scope the log view. */
export function Timeline({ logs, matches, alerts, range, onRange }: Props) {
  const span = useMemo(() => shiftSpan(logs), [logs]);
  const all = useMemo(() => bucketHistogram(logs, span, BUCKETS), [logs, span]);
  const hit = useMemo(() => bucketHistogram(matches, span, BUCKETS), [matches, span]);
  const max = Math.max(1, ...all.map((b) => b.total));
  const width = span.to - span.from;

  return (
    <section aria-labelledby="soc-timeline-h" className={`${PANEL} p-3`}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 id="soc-timeline-h" className={H}>Events over the shift</h3>
        <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 font-lp-mono text-[10.5px] text-[var(--soc-muted)]">
          {LOG_SOURCES.map((s) => <span key={s} className="flex items-center gap-1"><span aria-hidden className="inline-block h-2 w-2 rounded-sm" style={{ background: SOURCE_COLOR[s] }} />{s}</span>)}
        </span>
      </div>
      <div className="relative mt-2">
        <div className="flex items-end gap-px" style={{ height: BAR_H }} role="group" aria-label="Event histogram, one button per time bucket">
          {all.map((b, i) => {
            const active = range?.from === b.from;
            const label = `${hhmm(b.from)} to ${hhmm(b.to)}: ${hit[i].total} of ${b.total} lines match`;
            return (
              <button key={b.from} type="button" aria-pressed={active} aria-label={label} title={label} onClick={() => onRange(active ? null : { from: b.from, to: b.to })} className={`group relative flex h-full flex-1 items-end rounded-sm ${FOCUS} ${active ? "bg-[var(--soc-raised)]" : "hover:bg-[var(--soc-raised)]"}`}>
                <span aria-hidden className="absolute inset-x-0 bottom-0 bg-[var(--soc-line)] opacity-60" style={{ height: `${(b.total / max) * 100}%` }} />
                <span aria-hidden className="relative flex w-full flex-col-reverse">
                  {LOG_SOURCES.map((s) => hit[i].bySource[s] > 0 && <span key={s} style={{ height: (hit[i].bySource[s] / max) * BAR_H, background: SOURCE_COLOR[s] }} />)}
                </span>
              </button>
            );
          })}
        </div>
        <div aria-hidden className="relative mt-1 h-3">
          {alerts.map((a) => (
            <span key={a.id} title={`${a.id} ${a.rule} at ${a.ts.slice(11, 16)}`} className="absolute -translate-x-1/2 font-lp-mono text-[10px] leading-none text-[var(--soc-crit)]" style={{ left: `${((secOfDay(a.ts) - span.from) / width) * 100}%` }}>▲</span>
          ))}
        </div>
        <div className="mt-0.5 flex justify-between font-lp-mono text-[10.5px] text-[var(--soc-muted)]">
          <span>{hhmm(span.from)}</span>
          <span><span aria-hidden className="text-[var(--soc-crit)]">▲</span> alert fired</span>
          <span>{hhmm(span.to)}</span>
        </div>
      </div>
      {range && (
        <p className="mt-1.5 font-lp-mono text-[11px] text-[var(--soc-muted)]" aria-live="polite">
          Showing {hhmm(range.from)} to {hhmm(range.to)}. <button type="button" onClick={() => onRange(null)} className={`text-[var(--soc-accent)] underline ${FOCUS}`}>Clear time scope</button>
        </p>
      )}
    </section>
  );
}
