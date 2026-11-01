"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Calendar, Hash, Loader2, Plus, Table2, Type, X } from "lucide-react";
import { DATE_FORMATS, STEP_LABELS, applySteps, type CleaningStep } from "@/lib/arena-workstations/engines/cleaning";
import type { CleaningContent } from "@/lib/arena-workstations/tools/cleaning";
import { useDraft, type ToolProps } from "./useDraft";

type Op = CleaningStep["op"];
const OPS = Object.keys(STEP_LABELS) as Op[];
const inputClass = "rounded-sm border border-[var(--pq-line)] bg-white px-2 py-1 text-[12.5px] text-[var(--pq-ink)] outline-none focus:border-[var(--pq-blue)]";

function describeCandidateStep(s: CleaningStep): string {
  switch (s.op) {
    case "replace": return `${STEP_LABELS.replace}: ${s.column} "${s.from}" → "${s.to}"`;
    case "to_date": return `${STEP_LABELS.to_date}: ${s.column} from ${s.format}`;
    case "dedupe": return `${STEP_LABELS.dedupe} by ${s.columns.join(" + ")}`;
    case "filter": return `Keep rows where ${s.column} ${s.operator} ${s.value}`;
    default: return `${STEP_LABELS[s.op]}: ${s.column}`;
  }
}

function StepBuilder({ columns, onAdd }: { columns: string[]; onAdd: (s: CleaningStep) => void }) {
  const [op, setOp] = useState<Op>("trim");
  const [column, setColumn] = useState(columns[0]);
  const [dedupeCols, setDedupeCols] = useState<string[]>([columns[0]]);
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [format, setFormat] = useState<(typeof DATE_FORMATS)[number]>("DD/MM/YYYY");
  const [operator, setOperator] = useState<">" | ">=" | "<" | "<=" | "=" | "!=">(">");
  const [value, setValue] = useState("");

  function build(): CleaningStep | null {
    switch (op) {
      case "replace": return from ? { op, column, from, to } : null;
      case "to_date": return { op, column, format };
      case "dedupe": return dedupeCols.length ? { op, columns: dedupeCols } : null;
      case "filter": {
        if (value.trim() === "") return null;
        const n = Number(value);
        return { op, column, operator, value: value.trim() !== "" && Number.isFinite(n) ? n : value };
      }
      default: return { op, column };
    }
  }
  const step = build();

  return (
    <div className="flex flex-wrap items-end gap-2 border-b border-[var(--pq-line)] bg-white px-3 py-2">
      <label className="flex flex-col gap-1 text-[11px] text-[var(--pq-muted)]">
        Step
        <select value={op} onChange={(e) => setOp(e.target.value as Op)} className={inputClass}>
          {OPS.map((o) => (
            <option key={o} value={o}>
              {STEP_LABELS[o]}
            </option>
          ))}
        </select>
      </label>
      {op === "dedupe" ? (
        <fieldset className="flex flex-wrap gap-2 text-[11.5px] text-[var(--pq-ink)]">
          <legend className="mb-1 text-[11px] text-[var(--pq-muted)]">Duplicate when these match</legend>
          {columns.map((c) => (
            <label key={c} className="flex items-center gap-1">
              <input type="checkbox" checked={dedupeCols.includes(c)} onChange={(e) => setDedupeCols(e.target.checked ? [...dedupeCols, c] : dedupeCols.filter((x) => x !== c))} />
              {c}
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="flex flex-col gap-1 text-[11px] text-[var(--pq-muted)]">
          Column
          <select value={column} onChange={(e) => setColumn(e.target.value)} className={inputClass}>
            {columns.map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </label>
      )}
      {op === "replace" && (
        <>
          <label className="flex flex-col gap-1 text-[11px] text-[var(--pq-muted)]">
            Exact value
            <input value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-[var(--pq-muted)]">
            Replace with
            <input value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </label>
        </>
      )}
      {op === "to_date" && (
        <label className="flex flex-col gap-1 text-[11px] text-[var(--pq-muted)]">
          Incoming format
          <select value={format} onChange={(e) => setFormat(e.target.value as (typeof DATE_FORMATS)[number])} className={inputClass}>
            {DATE_FORMATS.map((f) => (
              <option key={f}>{f}</option>
            ))}
          </select>
        </label>
      )}
      {op === "filter" && (
        <>
          <label className="flex flex-col gap-1 text-[11px] text-[var(--pq-muted)]">
            Operator
            <select value={operator} onChange={(e) => setOperator(e.target.value as typeof operator)} className={inputClass}>
              {[">", ">=", "<", "<=", "=", "!="].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 text-[11px] text-[var(--pq-muted)]">
            Value
            <input value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
          </label>
        </>
      )}
      <button type="button" disabled={!step} onClick={() => step && onAdd(step)} className="flex items-center gap-1 rounded-sm bg-[var(--pq-yellow)] px-3 py-1.5 text-[12.5px] font-semibold text-[var(--pq-ink)] hover:brightness-95 disabled:opacity-40">
        <Plus size={13} />
        Apply step
      </button>
    </div>
  );
}

const PQ = {
  "--pq-line": "#d6d4d1",
  "--pq-pane": "#f5f4f2",
  "--pq-ink": "#252423",
  "--pq-muted": "#605e5c",
  "--pq-yellow": "#f2c811",
  "--pq-blue": "#118dff",
} as React.CSSProperties;

type Cellv = string | number | null;
const isEmpty = (v: Cellv) => v === null || (typeof v === "string" && v.trim() === "");
/** What Power Query's column-quality bar reports: values that fit the column's type, values that do not, and empties. */
function quality(type: string, values: Cellv[]) {
  let valid = 0, error = 0, empty = 0;
  for (const v of values) {
    if (isEmpty(v)) empty++;
    else if (type === "number" && typeof v !== "number") error++;
    else if (type === "date" && !(typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v))) error++;
    else valid++;
  }
  const n = Math.max(values.length, 1);
  return { valid: (valid / n) * 100, error: (error / n) * 100, empty: (empty / n) * 100 };
}
const pct = (n: number) => `${Math.round(n)}%`;

/**
 * A query editor in the shape of Power Query: the table with a quality bar under every column header, and on the right Query Settings with the Applied
 * Steps list. Clicking a step shows the table as it stood after that step, as in Power Query. Same closed step set and grading as before.
 */
export function CleaningTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<CleaningContent>) {
  const [steps, setSteps] = useDraft<CleaningStep[]>(attemptId, "steps", []);
  const [picked, setPicked] = useState<number | null>(null);
  const { dataset } = content;
  const shown = picked === null ? steps.length : Math.min(picked, steps.length);

  const preview = useMemo(() => {
    try {
      return { data: applySteps(dataset, steps.slice(0, shown)), error: null };
    } catch (e) {
      return { data: dataset, error: (e as Error).message };
    }
  }, [dataset, steps, shown]);

  const fullError = useMemo(() => {
    try {
      applySteps(dataset, steps);
      return null;
    } catch (e) {
      return (e as Error).message;
    }
  }, [dataset, steps]);

  const move = (i: number, d: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setSteps(next);
    setPicked(null);
  };

  const cols = dataset.columns;
  const typeIcon = (t: string) => (t === "number" ? <Hash size={12} /> : t === "date" ? <Calendar size={12} /> : <Type size={12} />);

  return (
    <div style={PQ} className="flex flex-col overflow-hidden rounded-lg border border-[var(--pq-line)] bg-white font-[Segoe_UI,system-ui,sans-serif] text-[var(--pq-ink)] shadow-[0_8px_24px_-12px_rgba(0,0,0,0.25)]">
      <div className="flex items-center gap-3 border-b border-[var(--pq-line)] bg-[var(--pq-pane)] px-3 py-1.5">
        <span className="flex h-5 w-5 items-center justify-center rounded-[3px] bg-[var(--pq-yellow)]" aria-hidden>
          <Table2 size={13} strokeWidth={2.4} />
        </span>
        <span className="text-[13px] font-semibold">Query editor</span>
        <span className="hidden text-[11.5px] text-[var(--pq-muted)] sm:inline">Power Query-style transform steps</span>
        {!closed && (
          <button type="button" onClick={() => onSubmit({ steps })} disabled={submitting || steps.length === 0 || Boolean(fullError)} className="ml-auto flex items-center gap-1.5 rounded-sm bg-[var(--pq-yellow)] px-3.5 py-1 text-[12.5px] font-semibold hover:brightness-95 disabled:opacity-50">
            {submitting && <Loader2 size={13} className="animate-spin" />}
            Close &amp; Load
          </button>
        )}
      </div>

      {!closed && <StepBuilder columns={cols.map((c) => c.name)} onAdd={(s) => { setSteps([...steps, s]); setPicked(null); }} />}

      <div className="flex min-h-[420px] flex-col lg:flex-row">
        <aside className="shrink-0 border-b border-[var(--pq-line)] bg-[var(--pq-pane)] px-3 py-2 lg:w-[150px] lg:border-b-0 lg:border-r" aria-label="Queries">
          <h3 className="text-[11.5px] font-semibold text-[var(--pq-muted)]">Queries [1]</h3>
          <p className="mt-1.5 flex items-center gap-1.5 rounded-sm bg-white px-1.5 py-1 text-[12.5px] font-semibold shadow-[inset_3px_0_0_var(--pq-yellow)]">
            <Table2 size={12} className="shrink-0" />
            <span className="truncate">{dataset.name}</span>
          </p>
        </aside>

        <div className="flex min-w-0 flex-1 flex-col">
          <div className="flex items-center gap-2 border-b border-[var(--pq-line)] px-3 py-1 text-[12px]">
            <span className="italic text-[var(--pq-muted)]">fx</span>
            <span className="truncate font-lp-mono text-[11.5px] text-[var(--pq-muted)]">= {shown === 0 ? `Source{[Name="${dataset.name}"]}` : describeCandidateStep(steps[shown - 1])}</span>
          </div>
          {preview.error && <p className="bg-[#fde7e9] px-3 py-1.5 text-[12.5px] text-[#a4262c]">{preview.error}</p>}
          <div className="max-h-[400px] flex-1 overflow-auto">
            <table className="w-full border-collapse text-[12.5px]">
              <thead className="sticky top-0 z-10 bg-white">
                <tr>
                  <th className="w-10 border-b border-r border-[var(--pq-line)] bg-[var(--pq-pane)]" aria-label="Row number" />
                  {cols.map((c) => {
                    const q = quality(c.type, preview.data.rows.map((r) => r[cols.indexOf(c)] as Cellv));
                    return (
                      <th key={c.name} className="min-w-[120px] border-b border-r border-[var(--pq-line)] p-0 text-left align-top font-normal" title={`Valid ${pct(q.valid)} · Error ${pct(q.error)} · Empty ${pct(q.empty)}`}>
                        <span className="flex items-center gap-1.5 px-2 pb-1 pt-1.5 font-semibold">
                          <span className="text-[var(--pq-muted)]">{typeIcon(c.type)}</span>
                          {c.name}
                        </span>
                        <span className="mx-2 flex h-[6px] overflow-hidden rounded-[1px] bg-[#e1dfdd]" aria-hidden>
                          <span style={{ width: `${q.valid}%` }} className="bg-[#107c10]" />
                          <span style={{ width: `${q.error}%` }} className="bg-[#d13438]" />
                        </span>
                        <span className="block px-2 pb-1.5 pt-0.5 text-[10.5px] font-normal text-[var(--pq-muted)]">
                          {pct(q.valid)} valid{q.error > 0 ? ` · ${pct(q.error)} error` : ""}{q.empty > 0 ? ` · ${pct(q.empty)} empty` : ""}
                        </span>
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                {preview.data.rows.map((row, i) => (
                  <tr key={i} className="border-b border-[#edebe9] hover:bg-[#f3f9ff]">
                    <td className="border-r border-[var(--pq-line)] bg-[var(--pq-pane)] px-2 py-1 text-right text-[11.5px] tabular-nums text-[var(--pq-muted)]">{i + 1}</td>
                    {row.map((v, j) => {
                      const col = cols[j];
                      const bad = col.type === "number" && typeof v === "string" && v.trim() !== "";
                      return (
                        <td key={j} className={`whitespace-nowrap border-r border-[#edebe9] px-2 py-1 ${typeof v === "number" ? "text-right tabular-nums" : ""} ${bad ? "bg-[#fde7e9]" : ""}`}>
                          {v === null ? <span className="italic text-[var(--pq-muted)]">null</span> : typeof v === "string" && v === "" ? <span className="italic text-[var(--pq-muted)]">(empty)</span> : typeof v === "string" && /^\s|\s$/.test(v) ? <span className="whitespace-pre bg-[#fff4ce]" title="Leading or trailing space">{v}</span> : typeof v === "number" ? v.toLocaleString("en-IN", { maximumFractionDigits: 4 }) : v}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="border-t border-[var(--pq-line)] bg-[var(--pq-pane)] px-3 py-1 text-[11.5px] text-[var(--pq-muted)]">
            {cols.length} columns, {preview.data.rows.length} of {dataset.rows.length} rows{shown < steps.length ? ` · showing the table after step ${shown}` : ""}
          </div>
        </div>

        <aside className="shrink-0 border-t border-[var(--pq-line)] bg-[var(--pq-pane)] lg:w-[250px] lg:border-l lg:border-t-0" aria-label="Query settings">
          <h3 className="border-b border-[var(--pq-line)] px-3 py-2 text-[13px] font-semibold">Query Settings</h3>
          <div className="px-3 py-2">
            <h4 className="text-[11.5px] font-semibold uppercase tracking-wide text-[var(--pq-muted)]">Applied steps</h4>
            <ol className="mt-1.5 flex flex-col">
              <li>
                <button type="button" onClick={() => setPicked(0)} aria-current={shown === 0} className={`w-full rounded-sm px-2 py-1.5 text-left text-[12.5px] ${shown === 0 ? "bg-white font-semibold shadow-[inset_3px_0_0_var(--pq-yellow)]" : "hover:bg-white/70"}`}>
                  Source
                </button>
              </li>
              {steps.map((s, i) => (
                <li key={i} className={`group flex items-center rounded-sm ${shown === i + 1 ? "bg-white shadow-[inset_3px_0_0_var(--pq-yellow)]" : "hover:bg-white/70"}`}>
                  <button type="button" onClick={() => setPicked(i + 1)} aria-current={shown === i + 1} title={describeCandidateStep(s)} className={`min-w-0 flex-1 truncate px-2 py-1.5 text-left text-[12.5px] ${shown === i + 1 ? "font-semibold" : ""}`}>
                    {describeCandidateStep(s)}
                  </button>
                  {!closed && (
                    <span className="flex shrink-0 items-center gap-0.5 pr-1.5">
                      <button type="button" aria-label="Move step up" disabled={i === 0} onClick={() => move(i, -1)} className="text-[var(--pq-muted)] disabled:opacity-25">
                        <ArrowUp size={12} />
                      </button>
                      <button type="button" aria-label="Move step down" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="text-[var(--pq-muted)] disabled:opacity-25">
                        <ArrowDown size={12} />
                      </button>
                      <button type="button" aria-label="Delete step" onClick={() => { setSteps(steps.filter((_, j) => j !== i)); setPicked(null); }} className="text-[var(--pq-muted)] hover:text-[#a4262c]">
                        <X size={13} />
                      </button>
                    </span>
                  )}
                </li>
              ))}
            </ol>
            {steps.length === 0 && <p className="mt-2 text-[12px] text-[var(--pq-muted)]">No steps yet. The table is the raw export. Pick a transform above and apply it.</p>}
          </div>
        </aside>
      </div>
    </div>
  );
}
