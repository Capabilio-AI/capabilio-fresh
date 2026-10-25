import { Check, X } from "lucide-react";
import type { Reading, Table } from "@/lib/arena-challenges/missions/types";

export function ReadingBar({ r }: { r: Reading }) {
  const bar = r.bar;
  const pos = (v: number) => (bar ? Math.max(0, Math.min(100, ((v - bar.min) / (bar.max - bar.min || 1)) * 100)) : 0);
  return (
    <div className="rounded-lg border border-[var(--m-rule)] bg-white px-3.5 py-3">
      <div className="flex items-baseline justify-between gap-2">
        <span className="font-lp-body text-[12px] text-app-muted">{r.label}</span>
        <span className={`flex items-center gap-1 font-lp-mono text-[13px] font-bold ${r.ok === false ? "text-app-rose" : r.ok ? "text-app-success" : "text-[var(--m-ink)]"}`}>
          {r.ok === true && <Check size={13} aria-label="within limit" />}
          {r.ok === false && <X size={13} aria-label="outside limit" />}
          {r.display}
        </span>
      </div>
      {bar && (
        <div className="relative mt-2.5 h-2 rounded-full bg-app-background" aria-hidden>
          <div className="absolute inset-y-0 rounded-full bg-app-success-container" style={{ left: `${bar.low === undefined ? 0 : pos(bar.low)}%`, right: `${bar.high === undefined ? 0 : 100 - pos(bar.high)}%` }} />
          <div className={`absolute top-1/2 h-4 w-1.5 -translate-x-1/2 -translate-y-1/2 rounded-sm ${r.ok === false ? "bg-app-rose" : "bg-app-charcoal"}`} style={{ left: `${pos(bar.value)}%` }} />
        </div>
      )}
    </div>
  );
}

export function ResultTable({ table }: { table: Table }) {
  return (
    <div className="overflow-x-auto rounded-lg border border-[var(--m-rule)] bg-white">
      <p className="px-3.5 pt-3 font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)]">{table.title}</p>
      <table className="mt-2 w-full min-w-[320px] border-collapse font-lp-mono text-[12.5px]">
        <thead>
          <tr>{table.columns.map((c) => <th key={c} scope="col" className="border-b border-[var(--m-rule)] px-3 py-1.5 text-left font-semibold text-app-muted">{c}</th>)}</tr>
        </thead>
        <tbody>
          {table.rows.map((row, i) => (
            <tr key={i} className={table.bad.includes(i) ? "bg-app-rose-container" : undefined}>
              {row.map((cell, j) => <td key={j} className="border-b border-[var(--m-rule)] px-3 py-1.5 text-[var(--m-ink)]">{cell}</td>)}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
