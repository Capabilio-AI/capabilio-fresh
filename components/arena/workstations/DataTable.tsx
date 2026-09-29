"use client";

import type { Cell, Column } from "@/lib/arena-workstations/engines/dataset";

const TYPE_BADGE: Record<string, string> = { number: "123", text: "abc", date: "date" };

function format(v: Cell) {
  if (v === null) return <span className="text-app-rose">NULL</span>;
  if (typeof v === "number") return v.toLocaleString("en-IN", { maximumFractionDigits: 4 });
  if (v === "") return <span className="text-app-muted">(empty)</span>;
  // Show stray whitespace in messy data so it can be spotted.
  return /^\s|\s$/.test(v) ? <span className="whitespace-pre bg-app-warning-container/60">{v}</span> : v;
}

export function DataTable({ columns, rows, maxHeight = 320, caption }: { columns: Column[]; rows: Cell[][]; maxHeight?: number; caption?: string }) {
  return (
    <div>
      {caption && <p className="mb-1.5 font-lp-mono text-[11px] text-app-muted">{caption}</p>}
      <div className="overflow-auto rounded-md border border-app-border" style={{ maxHeight }}>
        <table className="w-full border-collapse font-lp-mono text-[12px]">
          <thead className="sticky top-0 z-10 bg-app-background">
            <tr>
              {columns.map((c) => (
                <th key={c.name} className="whitespace-nowrap border-b border-app-border px-3 py-2 text-left font-semibold text-app-charcoal" title={c.description}>
                  {c.name}
                  <span className="ml-1.5 rounded bg-app-attention-container px-1 py-px text-[9.5px] font-normal text-app-attention">{TYPE_BADGE[c.type] ?? c.type}</span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i} className="border-b border-app-border last:border-0 even:bg-app-background/60">
                {row.map((v, j) => (
                  <td key={j} className={`whitespace-nowrap px-3 py-1.5 ${typeof v === "number" ? "text-right tabular-nums" : ""} text-app-charcoal`}>
                    {format(v)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

/** CSV export of a dataset so candidates can also work in their own spreadsheet/Python locally. */
export function toCsv(columns: Column[], rows: Cell[][]): string {
  const esc = (v: Cell) => (v === null ? "" : /[",\n]/.test(String(v)) ? `"${String(v).replace(/"/g, '""')}"` : String(v));
  return [columns.map((c) => c.name).join(","), ...rows.map((r) => r.map(esc).join(","))].join("\n");
}

export function DownloadCsv({ name, columns, rows }: { name: string; columns: Column[]; rows: Cell[][] }) {
  return (
    <a
      href={`data:text/csv;charset=utf-8,${encodeURIComponent(toCsv(columns, rows))}`}
      download={`${name}.csv`}
      className="font-lp-mono text-[11px] font-semibold text-app-blue hover:underline"
    >
      Download {name}.csv
    </a>
  );
}
