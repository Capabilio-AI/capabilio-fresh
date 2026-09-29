"use client";

import { useMemo, useState } from "react";
import { ArrowDown, ArrowUp, Loader2, Plus, Send, X } from "lucide-react";
import { DATE_FORMATS, STEP_LABELS, applySteps, type CleaningStep } from "@/lib/arena-workstations/engines/cleaning";
import type { CleaningContent } from "@/lib/arena-workstations/tools/cleaning";
import { DataTable } from "./DataTable";
import { useDraft, type ToolProps } from "./useDraft";

type Op = CleaningStep["op"];
const OPS = Object.keys(STEP_LABELS) as Op[];
const inputClass = "rounded-lg border border-app-border bg-white px-2.5 py-1.5 font-lp-body text-[12.5px] text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15";

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
    <div className="flex flex-wrap items-end gap-2 rounded-xl border border-dashed border-app-border bg-app-background/50 p-3">
      <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
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
        <fieldset className="flex flex-wrap gap-2 font-lp-mono text-[11px] text-app-charcoal">
          <legend className="mb-1 text-[10.5px] text-app-muted">Duplicate when these match</legend>
          {columns.map((c) => (
            <label key={c} className="flex items-center gap-1">
              <input type="checkbox" checked={dedupeCols.includes(c)} onChange={(e) => setDedupeCols(e.target.checked ? [...dedupeCols, c] : dedupeCols.filter((x) => x !== c))} />
              {c}
            </label>
          ))}
        </fieldset>
      ) : (
        <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
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
          <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
            Exact value
            <input value={from} onChange={(e) => setFrom(e.target.value)} className={inputClass} />
          </label>
          <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
            Replace with
            <input value={to} onChange={(e) => setTo(e.target.value)} className={inputClass} />
          </label>
        </>
      )}
      {op === "to_date" && (
        <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
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
          <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
            Operator
            <select value={operator} onChange={(e) => setOperator(e.target.value as typeof operator)} className={inputClass}>
              {[">", ">=", "<", "<=", "=", "!="].map((o) => (
                <option key={o}>{o}</option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-1 font-lp-mono text-[10.5px] text-app-muted">
            Value
            <input value={value} onChange={(e) => setValue(e.target.value)} className={inputClass} />
          </label>
        </>
      )}
      <button type="button" disabled={!step} onClick={() => step && onAdd(step)} className="flex items-center gap-1 rounded-lg bg-app-charcoal px-3 py-1.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-40">
        <Plus size={13} />
        Add step
      </button>
    </div>
  );
}

export function CleaningTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<CleaningContent>) {
  const [steps, setSteps] = useDraft<CleaningStep[]>(attemptId, "steps", []);
  const { dataset } = content;

  const preview = useMemo(() => {
    try {
      return { data: applySteps(dataset, steps), error: null };
    } catch (e) {
      return { data: dataset, error: (e as Error).message };
    }
  }, [dataset, steps]);

  const move = (i: number, d: -1 | 1) => {
    const next = [...steps];
    [next[i], next[i + d]] = [next[i + d], next[i]];
    setSteps(next);
  };

  return (
    <div className="flex flex-col gap-4">
      <section className="rounded-xl border border-app-border bg-white p-4">
        <h3 className="font-lp-body text-[12px] font-semibold text-app-charcoal">Applied steps</h3>
        {steps.length === 0 ? (
          <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">No steps yet — the preview shows the raw export.</p>
        ) : (
          <ol className="mt-2 flex flex-col gap-1.5">
            {steps.map((s, i) => (
              <li key={i} className="flex items-center gap-2 rounded-lg bg-app-background px-3 py-1.5 font-lp-mono text-[12px] text-app-charcoal">
                <span className="text-app-muted">{i + 1}.</span>
                <span className="flex-1">{describeCandidateStep(s)}</span>
                {!closed && (
                  <>
                    <button type="button" aria-label="Move up" disabled={i === 0} onClick={() => move(i, -1)} className="text-app-muted disabled:opacity-30">
                      <ArrowUp size={13} />
                    </button>
                    <button type="button" aria-label="Move down" disabled={i === steps.length - 1} onClick={() => move(i, 1)} className="text-app-muted disabled:opacity-30">
                      <ArrowDown size={13} />
                    </button>
                    <button type="button" aria-label="Remove step" onClick={() => setSteps(steps.filter((_, j) => j !== i))} className="text-app-rose">
                      <X size={13} />
                    </button>
                  </>
                )}
              </li>
            ))}
          </ol>
        )}
        {!closed && (
          <div className="mt-3">
            <StepBuilder columns={dataset.columns.map((c) => c.name)} onAdd={(s) => setSteps([...steps, s])} />
          </div>
        )}
      </section>

      <section>
        {preview.error && <p className="mb-2 rounded-lg bg-app-rose-container px-3 py-2 font-lp-body text-[12.5px] text-app-rose">{preview.error}</p>}
        <DataTable columns={dataset.columns} rows={preview.data.rows} maxHeight={320} caption={`Preview after your steps · ${preview.data.rows.length} of ${dataset.rows.length} rows`} />
      </section>

      {!closed && (
        <div>
          <button
            type="button"
            onClick={() => onSubmit({ steps })}
            disabled={submitting || steps.length === 0 || Boolean(preview.error)}
            className="flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
            Submit cleaned table
          </button>
        </div>
      )}
    </div>
  );
}
