"use client";

import { useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { SqlResult } from "@/lib/arena-workstations/engines/sql-runner";

type Mode = "table" | "bar" | "line";

function numericColumns(columns: string[], rows: (string | number | null)[][]): number[] {
  if (columns.length < 2 || rows.length === 0 || rows.length > 60) return [];
  return columns.map((_, i) => i).filter((i) => i > 0 && rows.every((r) => typeof r[i] === "number"));
}

function formatCell(v: string | number | null) {
  if (v === null) return "NULL";
  if (typeof v === "number") return v.toLocaleString("en-IN", { maximumFractionDigits: 2 });
  return v;
}

export function ResultView({ result }: { result: SqlResult }) {
  const [mode, setMode] = useState<Mode>("table");

  if ("error" in result) {
    return <pre className="whitespace-pre-wrap rounded-md bg-app-rose-container px-4 py-3 font-lp-mono text-[12.5px] text-app-rose">{result.error}</pre>;
  }
  if (result.columns.length === 0) {
    return <p className="px-1 font-lp-body text-[12.5px] text-app-muted">Statement ran. It returned no rows — only SELECT queries produce a result table.</p>;
  }

  const chartable = numericColumns(result.columns, result.rows);
  const data = result.rows.map((r) => Object.fromEntries(result.columns.map((c, i) => [c, r[i]])));
  const active = chartable.length > 0 ? mode : "table";

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <span className="font-lp-mono text-[11px] text-app-muted">
          {result.rows.length} row{result.rows.length === 1 ? "" : "s"}
          {result.truncated && " · showing the first 500"}
        </span>
        {chartable.length > 0 && (
          <div className="flex rounded-md border border-app-border p-0.5" role="group" aria-label="Result view">
            {(["table", "bar", "line"] as Mode[]).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMode(m)}
                aria-pressed={active === m}
                className={`rounded px-2.5 py-1 font-lp-mono text-[11px] capitalize ${active === m ? "bg-app-charcoal text-white" : "text-app-muted hover:text-app-charcoal"}`}
              >
                {m}
              </button>
            ))}
          </div>
        )}
      </div>

      {active === "table" ? (
        <div className="max-h-[340px] overflow-auto rounded-md border border-app-border">
          <table className="w-full border-collapse font-lp-mono text-[12.5px]">
            <thead className="sticky top-0 bg-app-background">
              <tr>
                {result.columns.map((c) => (
                  <th key={c} className="border-b border-app-border px-3 py-2 text-left font-semibold text-app-charcoal">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {result.rows.map((row, i) => (
                <tr key={i} className="border-b border-app-border last:border-0 even:bg-app-background/60">
                  {row.map((cell, ci) => (
                    <td key={ci} className={`whitespace-nowrap px-3 py-1.5 ${typeof cell === "number" ? "text-right tabular-nums" : ""} ${cell === null ? "text-app-rose" : "text-app-charcoal"}`}>
                      {formatCell(cell)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="h-[300px] rounded-md border border-app-border p-3">
          <ResponsiveContainer width="100%" height="100%">
            {active === "bar" ? (
              <BarChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={result.columns[0]} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {chartable.map((ci) => (
                  <Bar key={ci} dataKey={result.columns[ci]} fill="#3457a6" radius={[3, 3, 0, 0]} />
                ))}
              </BarChart>
            ) : (
              <LineChart data={data}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
                <XAxis dataKey={result.columns[0]} tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                {chartable.map((ci) => (
                  <Line key={ci} dataKey={result.columns[ci]} stroke="#3457a6" strokeWidth={2} dot={{ r: 3 }} />
                ))}
              </LineChart>
            )}
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}
