import type { HistoryItem } from "@/lib/assess/types";

/**
 * One segment per question: answered ones show how it went (green/red with a tick or cross for accessibility), the current one
 * pulses, the rest wait. It is the honest version of a progress bar: it tells you how you are doing, not just how far you are.
 */
export function SegmentedProgress({ total, history, current, answeredCurrent }: { total: number; history: HistoryItem[]; current: number; answeredCurrent: boolean }) {
  const byPos = new Map(history.map((h) => [h.position, h]));
  const answered = history.length;
  return (
    <div role="progressbar" aria-label="Assessment progress" aria-valuemin={0} aria-valuemax={total} aria-valuenow={answered} aria-valuetext={`${answered} of ${total} answered`} className="flex gap-1">
      {Array.from({ length: total }, (_, i) => {
        const pos = i + 1;
        const h = byPos.get(pos);
        const isCurrent = pos === current && !h && !answeredCurrent;
        return (
          <span
            key={pos}
            className={`h-2 min-w-0 flex-1 rounded-full transition-colors duration-500 ${h ? (h.correct ? "bg-[var(--ok)]" : "bg-[var(--bad)]") : isCurrent ? "a-current bg-[var(--hue-a)]" : "bg-[var(--m-ink)]/10"}`}
            title={h ? `Question ${pos}: ${h.correct ? "correct" : "incorrect"}` : `Question ${pos}`}
          />
        );
      })}
    </div>
  );
}
