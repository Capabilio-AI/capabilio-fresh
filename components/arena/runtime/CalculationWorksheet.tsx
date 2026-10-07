"use client";

import { useState } from "react";
import { evaluateExpression } from "@/lib/arena-runtime/client/calc-expression";
import { asRecord, checksOf, text, type RuntimeProps } from "./types";

/** Calculation worksheet: a scratch calculator, working notes (not graded), and one numeric answer box per NUMERIC_ANSWER check. */
export function CalculationWorksheet({ view, draft, onDraft, disabled }: RuntimeProps) {
  const answers = asRecord<string>(draft.answers);
  const fields = checksOf(view, "NUMERIC_ANSWER");
  const [expression, setExpression] = useState("");
  const result = expression.trim() ? evaluateExpression(expression) : null;

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <section aria-label="Scratch work" className="flex flex-col gap-4">
        <div>
          <label htmlFor="calc" className="font-lp-body text-[12px] font-semibold text-app-charcoal">Calculator</label>
          <input id="calc" value={expression} onChange={(e) => setExpression(e.target.value)} placeholder="e.g. 2.5 * (3 + 4) / sqrt(2)" disabled={disabled} className="mt-1 w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-mono text-[13px]" />
          <p aria-live="polite" className={`mt-1 min-h-5 font-lp-mono text-[12.5px] ${result && !result.ok ? "text-app-rose" : "text-app-charcoal"}`}>
            {result ? (result.ok ? `= ${Number(result.value.toPrecision(10))}` : result.error) : "Supports + − × ÷ ^ ( ), pi, e, sqrt, sin, cos, tan, ln, log."}
          </p>
        </div>
        <div>
          <label htmlFor="working" className="font-lp-body text-[12px] font-semibold text-app-charcoal">Your working (not graded)</label>
          <textarea id="working" value={text(draft.working)} onChange={(e) => onDraft({ ...draft, working: e.target.value })} rows={8} disabled={disabled} className="mt-1 w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-mono text-[12.5px]" />
        </div>
      </section>

      <section aria-label="Answers" className="flex flex-col gap-4">
        {fields.length === 0 && <p className="font-lp-body text-[13px] text-app-muted">This challenge has no answer fields yet.</p>}
        {fields.map((f) => {
          const label = text(f.public?.label) || f.label || "Answer";
          const unit = text(f.public?.unit);
          return (
            <div key={f.id}>
              <label htmlFor={f.id} className="font-lp-body text-[13px] font-semibold text-app-charcoal">{label}</label>
              {text(f.public?.prompt) && <p className="font-lp-body text-[12px] text-app-muted">{text(f.public?.prompt)}</p>}
              <div className="mt-1 flex items-center gap-2">
                <input id={f.id} inputMode="decimal" value={answers[f.id] ?? ""} onChange={(e) => onDraft({ ...draft, answers: { ...answers, [f.id]: e.target.value } })} disabled={disabled} className="w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-mono text-[14px]" />
                {unit && <span className="shrink-0 font-lp-mono text-[13px] text-app-muted">{unit}</span>}
              </div>
            </div>
          );
        })}
      </section>
    </div>
  );
}
