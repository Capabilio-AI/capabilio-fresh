"use client";

import { useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDownToLine, Loader2, Send } from "lucide-react";
import { address, columnLetters, evaluateSheet, isError, parseAddress, shiftFormulaRows, SUPPORTED_FUNCTIONS, type CellValue } from "@/lib/arena-workstations/engines/formula";
import type { SpreadsheetPublicContent } from "@/lib/arena-workstations/tools/spreadsheet";
import { useDraft, type ToolProps } from "./useDraft";

function display(v: CellValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (isError(v)) return v.error;
  if (typeof v === "number") return Number.isInteger(v) ? String(v) : String(Math.round(v * 10000) / 10000);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v;
}

export function SpreadsheetTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<SpreadsheetPublicContent>) {
  const { layout } = content;
  const [cells, setCells] = useDraft<Record<string, string>>(attemptId, "cells", {});
  const [selected, setSelected] = useState("A1");
  const [editing, setEditing] = useState<string | null>(null);
  const barRef = useRef<HTMLInputElement>(null);

  const locked = useMemo(() => new Set(layout.locked), [layout.locked]);
  const targets = useMemo(() => new Set(layout.targets.flatMap((t) => t.cells)), [layout.targets]);
  const sheet = useMemo(() => ({ ...cells, ...layout.cells }), [cells, layout.cells]);
  const values = useMemo(() => evaluateSheet(sheet), [sheet]);

  const rows = Math.max(layout.rows, content.data.rows.length + 6);
  const cols = Math.max(layout.cols, 8);
  const raw = sheet[selected] ?? "";
  const pos = parseAddress(selected)!;
  const selectedTarget = layout.targets.find((t) => t.cells.includes(selected));

  function commit(addr: string, value: string) {
    if (locked.has(addr) || closed) return;
    const next = { ...cells };
    if (value === "") delete next[addr];
    else next[addr] = value;
    setCells(next);
  }

  function move(dCol: number, dRow: number) {
    const col = Math.min(cols - 1, Math.max(0, pos.col + dCol));
    const row = Math.min(rows - 1, Math.max(0, pos.row + dRow));
    setSelected(address(col, row));
  }

  function fillDown() {
    if (!selectedTarget || !raw) return;
    const idx = selectedTarget.cells.indexOf(selected);
    const next = { ...cells };
    selectedTarget.cells.slice(idx + 1).forEach((cell, k) => (next[cell] = shiftFormulaRows(raw, k + 1)));
    setCells(next);
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    if (editing) return;
    const moves: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], Tab: [1, 0] };
    if (moves[e.key]) {
      e.preventDefault();
      move(...moves[e.key]);
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      if (!locked.has(selected) && !closed) {
        setEditing(selected);
        requestAnimationFrame(() => barRef.current?.focus());
      }
    } else if ((e.key === "Backspace" || e.key === "Delete") && !locked.has(selected)) {
      commit(selected, "");
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && !locked.has(selected) && !closed) {
      setEditing(selected);
      commit(selected, e.key);
      requestAnimationFrame(() => {
        barRef.current?.focus();
        barRef.current?.setSelectionRange(1, 1);
      });
    }
  }

  const doneTargets = layout.targets.filter((t) => t.cells.every((c) => (cells[c] ?? "").startsWith("="))).length;

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-app-border bg-white px-2 py-1.5">
        <span className="w-14 shrink-0 rounded bg-app-background px-2 py-1 text-center font-lp-mono text-[12px] font-semibold text-app-charcoal">{selected}</span>
        <span className="font-lp-mono text-[12px] italic text-app-muted">fx</span>
        <input
          ref={barRef}
          value={raw}
          disabled={locked.has(selected) || closed}
          onChange={(e) => {
            setEditing(selected);
            commit(selected, e.target.value);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              setEditing(null);
              move(0, 1);
            } else if (e.key === "Escape") setEditing(null);
          }}
          onBlur={() => setEditing(null)}
          aria-label={`Formula for ${selected}`}
          placeholder={locked.has(selected) ? "Source data (locked)" : "Type a value or =formula"}
          className="min-w-0 flex-1 bg-transparent px-1 py-1 font-lp-mono text-[13px] text-app-charcoal outline-none disabled:text-app-muted"
        />
        {selectedTarget && selectedTarget.cells.length > 1 && !closed && (
          <button type="button" onClick={fillDown} disabled={!raw.startsWith("=")} className="flex items-center gap-1 rounded-md border border-app-border px-2 py-1 font-lp-mono text-[11px] font-semibold text-app-charcoal disabled:opacity-40">
            <ArrowDownToLine size={12} />
            Fill down
          </button>
        )}
      </div>

      <div tabIndex={0} onKeyDown={onGridKey} className="max-h-[440px] overflow-auto rounded-lg border border-app-border bg-white outline-none focus:ring-2 focus:ring-app-blue/30" role="grid" aria-label="Workbook">
        <table className="border-collapse font-lp-mono text-[12px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 w-10 border border-app-border bg-app-attention-container" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className={`min-w-[96px] border border-app-border px-2 py-1 font-semibold ${c === pos.col ? "bg-app-blue-container text-app-blue" : "bg-app-attention-container text-app-attention"}`}>
                  {columnLetters(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th className={`sticky left-0 z-10 border border-app-border px-2 text-right font-semibold ${r === pos.row ? "bg-app-blue-container text-app-blue" : "bg-app-attention-container text-app-attention"}`}>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const addr = address(c, r);
                  const v = values[addr];
                  const isLocked = locked.has(addr);
                  const isTarget = targets.has(addr);
                  const isSel = addr === selected;
                  const header = r === 0 && isLocked;
                  return (
                    <td
                      key={c}
                      role="gridcell"
                      aria-selected={isSel}
                      onClick={() => setSelected(addr)}
                      onDoubleClick={() => {
                        setSelected(addr);
                        if (!isLocked && !closed) requestAnimationFrame(() => barRef.current?.focus());
                      }}
                      className={`h-7 max-w-[160px] cursor-cell truncate border px-2 ${isSel ? "border-app-blue outline outline-2 -outline-offset-2 outline-app-blue" : "border-app-border"} ${
                        header ? "bg-app-background font-semibold text-app-charcoal" : isLocked ? "bg-app-background/60 text-app-charcoal" : isTarget ? "bg-app-orange-container/60" : "bg-white"
                      } ${typeof v === "number" ? "text-right tabular-nums" : ""} ${v && isError(v) ? "text-app-rose" : ""}`}
                    >
                      {display(v)}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="font-lp-body text-[11.5px] text-app-muted">
        Grey cells are the source data (locked). Orange cells are yours to fill with formulas that reference the data — typed-in numbers don&apos;t count. Supported: {SUPPORTED_FUNCTIONS.join(", ")}.
      </p>

      {!closed && (
        <div className="flex items-center gap-3">
          <button type="button" onClick={() => onSubmit({ cells })} disabled={submitting} className="flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submit workbook
          </button>
          <span className="font-lp-mono text-[11px] text-app-muted">
            {doneTargets}/{layout.targets.length} tasks have formulas
          </span>
        </div>
      )}
    </div>
  );
}
