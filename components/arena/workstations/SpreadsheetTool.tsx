"use client";

import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { ArrowDownToLine, Eraser, Loader2, Send, Sigma, Table2 } from "lucide-react";
import { address, columnLetters, evaluateSheet, isError, parseAddress, shiftFormulaRows, SUPPORTED_FUNCTIONS, type CellValue } from "@/lib/arena-workstations/engines/formula";
import { pivotSeries, type PivotConfig } from "@/lib/arena-workstations/engines/spreadsheet";
import type { SpreadsheetPublicContent } from "@/lib/arena-workstations/tools/spreadsheet";
import { useDraft, type ToolProps } from "./useDraft";

/**
 * A workbook that behaves like Excel for the things an analyst does all day: name box, formula bar, range selection with a live Sum / Average / Count in
 * the status bar, AutoSum, Fill Down (Ctrl+D), a Formulas tab to insert functions. The colours are Excel's own (a green workbook on white gridlines), scoped
 * to this component so the rest of the app keeps its theme. Nothing here is decorative: every button does what its label says.
 */
const XL = {
  "--xl-green": "#217346",
  "--xl-green-dark": "#185c37",
  "--xl-green-tint": "#e2f1e8",
  "--xl-head": "#f3f3f3",
  "--xl-head-on": "#d2e8dc",
  "--xl-grid": "#d9d9d9",
  "--xl-ink": "#1f1f1f",
  "--xl-muted": "#605e5c",
  "--xl-target": "#fff4e0",
  "--xl-error": "#c42b1c",
} as React.CSSProperties;

type Tab = "Home" | "Insert" | "Formulas";
type Range = { c1: number; r1: number; c2: number; r2: number };

function display(v: CellValue | undefined): string {
  if (v === null || v === undefined) return "";
  if (isError(v)) return v.error;
  if (typeof v === "number") return Number.isInteger(v) ? v.toLocaleString("en-IN") : String(Math.round(v * 10000) / 10000);
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  return v;
}

function rangeOf(a: { col: number; row: number }, b: { col: number; row: number }): Range {
  return { c1: Math.min(a.col, b.col), c2: Math.max(a.col, b.col), r1: Math.min(a.row, b.row), r2: Math.max(a.row, b.row) };
}

export function SpreadsheetTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<SpreadsheetPublicContent>) {
  const { layout } = content;
  const [cells, setCells] = useDraft<Record<string, string>>(attemptId, "cells", {});
  const [pivots, setPivots] = useDraft<Record<string, PivotConfig>>(attemptId, "pivots", {});
  const [active, setActive] = useState("A1");
  const [extent, setExtent] = useState("A1");
  const [editing, setEditing] = useState(false);
  const [tab, setTab] = useState<Tab>("Home");
  const barRef = useRef<HTMLInputElement>(null);
  const dragging = useRef(false);

  const locked = useMemo(() => new Set(layout.locked), [layout.locked]);
  const targets = useMemo(() => new Set(layout.targets.flatMap((t) => t.cells)), [layout.targets]);
  const sheet = useMemo(() => ({ ...cells, ...layout.cells }), [cells, layout.cells]);
  const values = useMemo(() => evaluateSheet(sheet), [sheet]);

  const rows = Math.max(layout.rows, content.data.rows.length + 6);
  const cols = Math.max(layout.cols, 8);
  const raw = sheet[active] ?? "";
  const pos = parseAddress(active)!;
  const ext = parseAddress(extent) ?? pos;
  const sel = rangeOf(pos, ext);
  const isRange = sel.c1 !== sel.c2 || sel.r1 !== sel.r2;
  const selectedTarget = layout.targets.find((t) => t.cells.includes(active));
  const canEdit = !locked.has(active) && !closed;

  useEffect(() => {
    const stop = () => (dragging.current = false);
    window.addEventListener("mouseup", stop);
    return () => window.removeEventListener("mouseup", stop);
  }, []);

  // The status bar sums what is selected, like Excel: numbers only.
  const stats = (() => {
    const nums: number[] = [];
    let count = 0;
    for (let r = sel.r1; r <= sel.r2; r++)
      for (let c = sel.c1; c <= sel.c2; c++) {
        const v = values[address(c, r)];
        if (v !== null && v !== undefined && v !== "") count++;
        if (typeof v === "number") nums.push(v);
      }
    const sum = nums.reduce((s, n) => s + n, 0);
    return { count, numeric: nums.length, sum, avg: nums.length ? sum / nums.length : 0 };
  })();

  function write(patch: Record<string, string | null>) {
    if (closed) return;
    const next = { ...cells };
    for (const [addr, v] of Object.entries(patch)) {
      if (locked.has(addr)) continue;
      if (v === null || v === "") delete next[addr];
      else next[addr] = v;
    }
    setCells(next);
  }

  function select(addr: string, extend = false) {
    setActive(extend ? active : addr);
    setExtent(addr);
    setEditing(false);
  }

  function move(dCol: number, dRow: number, extend: boolean) {
    const from = extend ? ext : pos;
    const to = address(Math.min(cols - 1, Math.max(0, from.col + dCol)), Math.min(rows - 1, Math.max(0, from.row + dRow)));
    if (extend) setExtent(to);
    else select(to);
  }

  function focusBar(at?: number) {
    setEditing(true);
    // focus now, not next frame: a fast typist's next keystrokes must land in the bar, not be dropped by the grid
    barRef.current?.focus();
    if (at !== undefined) requestAnimationFrame(() => barRef.current?.setSelectionRange(at, at));
  }

  function fillDown() {
    if (closed) return;
    const patch: Record<string, string | null> = {};
    if (isRange && sel.r2 > sel.r1) {
      for (let c = sel.c1; c <= sel.c2; c++) {
        const top = sheet[address(c, sel.r1)] ?? "";
        for (let r = sel.r1 + 1; r <= sel.r2; r++) patch[address(c, r)] = shiftFormulaRows(top, r - sel.r1);
      }
    } else if (selectedTarget && raw) {
      const idx = selectedTarget.cells.indexOf(active);
      selectedTarget.cells.slice(idx + 1).forEach((cell, k) => (patch[cell] = shiftFormulaRows(raw, k + 1)));
    }
    write(patch);
  }

  /** =SUM over the numbers directly above the active cell, down from the first data row, as AutoSum does. */
  function autoSum() {
    if (!canEdit) return;
    let top = pos.row - 1;
    while (top > 0 && typeof values[address(pos.col, top - 1)] === "number") top--;
    const formula = pos.row > 1 && typeof values[address(pos.col, pos.row - 1)] === "number" ? `=SUM(${address(pos.col, top)}:${address(pos.col, pos.row - 1)})` : "=SUM(";
    write({ [active]: formula });
    focusBar(formula.length);
  }

  function insertFunction(fn: string) {
    if (!canEdit) return;
    const base = raw.startsWith("=") ? raw : "=";
    write({ [active]: `${base}${fn}(` });
    focusBar();
  }

  function clearSelection() {
    const patch: Record<string, null> = {};
    for (let r = sel.r1; r <= sel.r2; r++) for (let c = sel.c1; c <= sel.c2; c++) patch[address(c, r)] = null;
    write(patch);
  }

  function onGridKey(e: KeyboardEvent<HTMLDivElement>) {
    if (editing) return;
    const arrows: Record<string, [number, number]> = { ArrowUp: [0, -1], ArrowDown: [0, 1], ArrowLeft: [-1, 0], ArrowRight: [1, 0], Tab: [1, 0] };
    if (arrows[e.key]) {
      e.preventDefault();
      move(...arrows[e.key], e.shiftKey && e.key !== "Tab");
    } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "d") {
      e.preventDefault();
      fillDown();
    } else if (e.key === "Enter" || e.key === "F2") {
      e.preventDefault();
      if (canEdit) focusBar();
    } else if (e.key === "Backspace" || e.key === "Delete") {
      e.preventDefault();
      clearSelection();
    } else if (e.key.length === 1 && !e.metaKey && !e.ctrlKey && canEdit) {
      e.preventDefault();
      write({ [active]: e.key });
      focusBar(1);
    }
  }

  const pivotTasks = layout.targets.filter((t) => t.pivot);
  const doneTargets = layout.targets.filter((t) => (t.pivot ? Boolean(pivots[String(t.task)]) : t.cells.every((c) => (cells[c] ?? "").startsWith("=")))).length;
  const nameBox = isRange ? `${address(sel.c1, sel.r1)}:${address(sel.c2, sel.r2)}` : active;
  const sheetName = content.data.name.replace(/_/g, " ");
  const money = (n: number) => n.toLocaleString("en-IN", { maximumFractionDigits: 2 });

  return (
    <div style={XL} className="flex flex-col overflow-hidden rounded-lg border border-[var(--xl-grid)] bg-white font-[Aptos,Calibri,'Segoe_UI',system-ui,sans-serif] text-[var(--xl-ink)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3 bg-[var(--xl-green)] px-3 py-1.5 text-white">
        <span className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-white text-[11px] font-bold text-[var(--xl-green)]" aria-hidden>
          X
        </span>
        <span className="min-w-0 truncate text-[13px] font-semibold">{content.data.name}.xlsx</span>
        <span className="hidden text-[11.5px] text-white/75 sm:inline">{closed ? "Submitted" : "Saved to this device"}</span>
        <span className="ml-auto text-[11.5px] text-white/85">
          {doneTargets}/{layout.targets.length} tasks have formulas
        </span>
        {!closed && (
          <button type="button" onClick={() => onSubmit({ cells, pivots })} disabled={submitting} className="flex items-center gap-1.5 rounded bg-white px-3 py-1 text-[12.5px] font-semibold text-[var(--xl-green-dark)] hover:bg-[var(--xl-green-tint)] disabled:opacity-50">
            {submitting ? <Loader2 size={13} className="animate-spin" /> : <Send size={13} />}
            Submit workbook
          </button>
        )}
      </div>

      <div role="tablist" aria-label="Ribbon" className="flex gap-0.5 border-b border-[var(--xl-grid)] bg-[var(--xl-head)] px-2 pt-1">
        {((pivotTasks.length > 0 ? ["Home", "Insert", "Formulas"] : ["Home", "Formulas"]) as Tab[]).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} onClick={() => setTab(t)} className={`rounded-t px-3.5 py-1 text-[12.5px] ${tab === t ? "border border-b-white border-[var(--xl-grid)] bg-white font-semibold text-[var(--xl-green-dark)]" : "border border-transparent text-[var(--xl-muted)] hover:bg-white/60"}`}>
            {t}
          </button>
        ))}
      </div>
      <div className="flex min-h-[54px] flex-wrap items-center gap-1 border-b border-[var(--xl-grid)] bg-white px-3 py-1.5">
        {tab === "Insert" ? (
          <p className="flex items-center gap-2 text-[12.5px] text-[var(--xl-muted)]">
            <Table2 size={16} className="text-[var(--xl-green-dark)]" aria-hidden />
            PivotTable: set the fields for each pivot below the grid. The table updates as you choose.
          </p>
        ) : tab === "Home" ? (
          <>
            <RibbonButton icon={<Sigma size={17} />} label="AutoSum" hint="Sum the numbers above the active cell" onClick={autoSum} disabled={!canEdit} />
            <RibbonButton icon={<ArrowDownToLine size={17} />} label="Fill Down" hint="Copy the top cell's formula down the selection (Ctrl+D)" onClick={fillDown} disabled={closed || (!isRange && !selectedTarget)} />
            <RibbonButton icon={<Eraser size={17} />} label="Clear" hint="Clear the selected cells (Delete)" onClick={clearSelection} disabled={closed} />
          </>
        ) : (
          <div className="flex flex-wrap gap-1" aria-label="Functions you can use">
            {SUPPORTED_FUNCTIONS.map((fn) => (
              <button key={fn} type="button" onClick={() => insertFunction(fn)} disabled={!canEdit} title={`Insert ${fn}(`} className="rounded border border-transparent px-2 py-1 text-[12px] font-semibold text-[var(--xl-green-dark)] hover:border-[var(--xl-grid)] hover:bg-[var(--xl-green-tint)] disabled:opacity-40">
                {fn}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex items-center gap-1 border-b border-[var(--xl-grid)] bg-white px-1.5 py-1">
        <span className="w-[88px] shrink-0 rounded-sm border border-[var(--xl-grid)] px-2 py-0.5 text-center text-[12.5px] tabular-nums" aria-label="Name box">
          {nameBox}
        </span>
        <span className="px-1.5 text-[13px] italic text-[var(--xl-muted)]" aria-hidden>
          fx
        </span>
        <input
          ref={barRef}
          value={raw}
          disabled={!canEdit}
          onChange={(e) => {
            setEditing(true);
            write({ [active]: e.target.value });
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              move(0, 1, false);
              requestAnimationFrame(() => document.getElementById(`xl-grid-${attemptId}`)?.focus());
            } else if (e.key === "Escape") {
              setEditing(false);
              document.getElementById(`xl-grid-${attemptId}`)?.focus();
            }
          }}
          onBlur={() => setEditing(false)}
          aria-label={`Formula for ${active}`}
          placeholder={locked.has(active) ? "Source data (locked)" : "Type a value or =formula"}
          className="min-w-0 flex-1 bg-transparent px-1 py-0.5 text-[13px] outline-none disabled:text-[var(--xl-muted)]"
        />
      </div>

      <div id={`xl-grid-${attemptId}`} tabIndex={0} onKeyDown={onGridKey} role="grid" aria-label="Workbook" aria-multiselectable className="max-h-[440px] overflow-auto bg-white outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-[var(--xl-green)]/40 select-none">
        <table className="border-collapse text-[13px]">
          <thead className="sticky top-0 z-10">
            <tr>
              <th className="sticky left-0 z-20 h-6 w-10 border border-[var(--xl-grid)] bg-[var(--xl-head)]" />
              {Array.from({ length: cols }, (_, c) => (
                <th key={c} className={`h-6 min-w-[104px] border border-[var(--xl-grid)] px-2 text-[12px] font-normal ${c >= sel.c1 && c <= sel.c2 ? "border-b-2 border-b-[var(--xl-green)] bg-[var(--xl-head-on)] font-semibold" : "bg-[var(--xl-head)] text-[var(--xl-muted)]"}`}>
                  {columnLetters(c)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {Array.from({ length: rows }, (_, r) => (
              <tr key={r}>
                <th className={`sticky left-0 z-10 h-[22px] border border-[var(--xl-grid)] px-2 text-center text-[12px] font-normal ${r >= sel.r1 && r <= sel.r2 ? "border-r-2 border-r-[var(--xl-green)] bg-[var(--xl-head-on)] font-semibold" : "bg-[var(--xl-head)] text-[var(--xl-muted)]"}`}>{r + 1}</th>
                {Array.from({ length: cols }, (_, c) => {
                  const addr = address(c, r);
                  const v = values[addr];
                  const isLocked = locked.has(addr);
                  const inSel = c >= sel.c1 && c <= sel.c2 && r >= sel.r1 && r <= sel.r2;
                  const isActive = addr === active;
                  const header = r === 0 && isLocked;
                  const shown = isActive && editing ? raw : display(v);
                  return (
                    <td
                      key={c}
                      role="gridcell"
                      aria-selected={inSel}
                      onMouseDown={(e) => {
                        if (e.shiftKey) setExtent(addr);
                        else select(addr);
                        dragging.current = true;
                      }}
                      onMouseEnter={() => dragging.current && setExtent(addr)}
                      onDoubleClick={() => canEdit && focusBar()}
                      className={`h-[22px] max-w-[220px] cursor-cell truncate border px-1.5 ${isActive ? "border-2 border-[var(--xl-green)]" : "border-[var(--xl-grid)]"} ${inSel && !isActive ? "bg-[var(--xl-green-tint)]" : header ? "bg-[var(--xl-head)] font-semibold" : targets.has(addr) ? "bg-[var(--xl-target)]" : "bg-white"} ${typeof v === "number" && !(isActive && editing) ? "text-right tabular-nums" : ""} ${v && isError(v) && !editing ? "text-[var(--xl-error)]" : ""}`}
                    >
                      {shown}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {tab === "Insert" && pivotTasks.length > 0 && (
        <div className="grid gap-3 border-t border-[var(--xl-grid)] bg-[#fafafa] p-3 md:grid-cols-2" aria-label="PivotTables">
          {pivotTasks.map((t) => {
            const key = String(t.task);
            const task = content.tasks[t.task] as Extract<SpreadsheetPublicContent["tasks"][number], { type: "pivot" }>;
            const cfg: PivotConfig = pivots[key] ?? { rows: content.data.columns[0].name, values: null, fn: "COUNT" };
            const numeric = content.data.columns.filter((c) => c.type === "number").map((c) => c.name);
            let table: { label: string; value: number }[] = [];
            let problem: string | null = null;
            try {
              table = pivotSeries(content.data, cfg);
            } catch (e) {
              problem = (e as Error).message;
            }
            const set = (patch: Partial<PivotConfig>) => {
              if (closed) return;
              const next = { ...cfg, ...patch };
              if (next.fn === "COUNT") next.values = null;
              else if (next.values === null) next.values = numeric[0] ?? null;
              setPivots({ ...pivots, [key]: next });
            };
            return (
              <section key={key} className="rounded-sm border border-[var(--xl-grid)] bg-white p-2.5">
                <h4 className="text-[12.5px] font-semibold">PivotTable: {task.label}</h4>
                <div className="mt-1.5 flex flex-wrap items-end gap-2 text-[11.5px] text-[var(--xl-muted)]">
                  <label className="flex flex-col gap-0.5">Rows
                    <select value={cfg.rows} disabled={closed} onChange={(e) => set({ rows: e.target.value })} className="rounded-sm border border-[var(--xl-grid)] bg-white px-1.5 py-1 text-[12.5px] text-[var(--xl-ink)]">
                      {content.data.columns.map((c) => <option key={c.name}>{c.name}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">Values
                    <select value={cfg.values ?? ""} disabled={closed || cfg.fn === "COUNT"} onChange={(e) => set({ values: e.target.value || null })} className="rounded-sm border border-[var(--xl-grid)] bg-white px-1.5 py-1 text-[12.5px] text-[var(--xl-ink)] disabled:opacity-50">
                      {cfg.fn === "COUNT" && <option value="">(rows)</option>}
                      {numeric.map((m) => <option key={m}>{m}</option>)}
                    </select>
                  </label>
                  <label className="flex flex-col gap-0.5">Summarise by
                    <select value={cfg.fn} disabled={closed} onChange={(e) => set({ fn: e.target.value as PivotConfig["fn"] })} className="rounded-sm border border-[var(--xl-grid)] bg-white px-1.5 py-1 text-[12.5px] text-[var(--xl-ink)]">
                      <option value="SUM">Sum</option>
                      <option value="AVERAGE">Average</option>
                      <option value="COUNT">Count</option>
                    </select>
                  </label>
                </div>
                {problem ? (
                  <p className="mt-2 text-[12px] text-[var(--xl-error)]">{problem}</p>
                ) : (
                  <table className="mt-2 w-full border-collapse text-[12.5px]">
                    <thead>
                      <tr className="bg-[var(--xl-head)] text-left">
                        <th className="border border-[var(--xl-grid)] px-2 py-1 font-semibold">{cfg.rows}</th>
                        <th className="border border-[var(--xl-grid)] px-2 py-1 text-right font-semibold">{cfg.fn === "COUNT" ? "Count of rows" : `${cfg.fn === "SUM" ? "Sum" : "Average"} of ${cfg.values}`}</th>
                      </tr>
                    </thead>
                    <tbody>
                      {table.map((r) => (
                        <tr key={r.label}>
                          <td className="border border-[var(--xl-grid)] px-2 py-0.5">{r.label}</td>
                          <td className="border border-[var(--xl-grid)] px-2 py-0.5 text-right tabular-nums">{r.value.toLocaleString("en-IN")}</td>
                        </tr>
                      ))}
                      <tr className="bg-[var(--xl-head)] font-semibold">
                        <td className="border border-[var(--xl-grid)] px-2 py-0.5">Grand total</td>
                        <td className="border border-[var(--xl-grid)] px-2 py-0.5 text-right tabular-nums">{cfg.fn === "AVERAGE" ? "" : table.reduce((a, r) => a + r.value, 0).toLocaleString("en-IN")}</td>
                      </tr>
                    </tbody>
                  </table>
                )}
              </section>
            );
          })}
        </div>
      )}

      <div className="flex items-end gap-0.5 border-t border-[var(--xl-grid)] bg-[var(--xl-head)] px-2 pt-1">
        <span className="rounded-t border border-b-white border-[var(--xl-grid)] bg-white px-4 py-0.5 text-[12.5px] font-semibold text-[var(--xl-green-dark)]" style={{ marginBottom: -1 }}>
          {sheetName}
        </span>
      </div>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1 bg-[var(--xl-green)] px-3 py-1 text-[11.5px] text-white/90">
        <span>{closed ? "Closed" : editing ? "Edit" : "Ready"}</span>
        <span className="hidden sm:inline">Orange cells are yours. Grey headers are locked source data. Typed-in numbers do not count.</span>
        {stats.numeric > 0 && (
          <span className="ml-auto flex gap-4 tabular-nums">
            <span>Average: {money(stats.avg)}</span>
            <span>Count: {stats.count}</span>
            <span>Sum: {money(stats.sum)}</span>
          </span>
        )}
        {stats.numeric === 0 && stats.count > 0 && <span className="ml-auto tabular-nums">Count: {stats.count}</span>}
      </div>
    </div>
  );
}

function RibbonButton({ icon, label, hint, onClick, disabled }: { icon: React.ReactNode; label: string; hint: string; onClick: () => void; disabled?: boolean }) {
  return (
    <button type="button" onClick={onClick} disabled={disabled} title={hint} className="flex min-w-[68px] flex-col items-center gap-0.5 whitespace-nowrap rounded px-2 py-1 text-[11.5px] text-[var(--xl-ink)] hover:bg-[var(--xl-green-tint)] disabled:opacity-40 disabled:hover:bg-transparent">
      <span className="text-[var(--xl-green-dark)]">{icon}</span>
      {label}
    </button>
  );
}
