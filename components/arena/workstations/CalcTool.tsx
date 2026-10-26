"use client";

import { Loader2, Send } from "lucide-react";
import type { CalcContent } from "@/lib/workplace/calc/types";
import { useDraft, type ToolProps } from "./useDraft";

const FIELD = "w-full min-w-0 rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13.5px] font-normal text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15 disabled:opacity-60";

/** An engineering worksheet: read the given values, apply the formulas, type each result. The server checks them against a key this page never receives. */
export function CalcTool({ attemptId, content, closed, submitting, onSubmit, lastChecks }: ToolProps<CalcContent>) {
  const [answers, setAnswers] = useDraft<Record<string, string>>(attemptId, "answers", {});
  const complete = content.fields.every((f) => (answers[f.key] ?? "").trim() !== "");
  const failed = new Set((lastChecks ?? []).filter((c) => !c.passed).map((c) => c.label));

  return (
    <div className="flex flex-col gap-4">
      <section aria-labelledby="calc-given-h" className="rounded-xl border border-app-border bg-white p-4 sm:p-5">
        <h3 id="calc-given-h" className="font-lp-display text-[18px] font-bold text-app-charcoal">Given values</h3>
        <div className="mt-3 overflow-x-auto">
          <table className="w-full min-w-[280px] border-collapse font-lp-body text-[13px] text-app-charcoal">
            <caption className="sr-only">Input parameters with units</caption>
            <thead>
              <tr className="border-b border-app-border text-left text-[12px] text-app-muted">
                <th scope="col" className="py-1.5 pr-3 font-semibold">Parameter</th>
                <th scope="col" className="py-1.5 pr-3 text-right font-semibold">Value</th>
                <th scope="col" className="py-1.5 font-semibold">Unit</th>
              </tr>
            </thead>
            <tbody>
              {content.params.map((p) => (
                <tr key={p.label} className="border-b border-app-border/60 last:border-0">
                  <th scope="row" className="py-1.5 pr-3 text-left font-normal">{p.label}</th>
                  <td className="py-1.5 pr-3 text-right font-lp-mono">{p.value}</td>
                  <td className="py-1.5 font-lp-mono text-app-muted">{p.unit}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {content.reference.length > 0 && (
        <section aria-labelledby="calc-ref-h" className="rounded-xl border border-app-border bg-white p-4 sm:p-5">
          <h3 id="calc-ref-h" className="font-lp-body text-[12px] font-semibold text-app-charcoal">Formula sheet</h3>
          <ul className="mt-2 flex flex-col gap-1 font-lp-mono text-[12.5px] text-app-charcoal">
            {content.reference.map((r) => <li key={r}>{r}</li>)}
          </ul>
        </section>
      )}

      <section aria-labelledby="calc-ans-h" className="rounded-xl border border-app-border bg-white p-4 sm:p-5">
        <h3 id="calc-ans-h" className="font-lp-display text-[18px] font-bold text-app-charcoal">Your results</h3>
        <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{content.deliverable} You have {content.maxSubmissions} tries.</p>
        <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
          {content.fields.map((f) => {
            const id = `calc-${f.key}`;
            return (
              <div key={f.key}>
                <label htmlFor={id} className="block font-lp-body text-[13px] font-semibold text-app-charcoal">{f.label}</label>
                {f.help && <span id={`${id}-help`} className="block text-[12px] text-app-muted">{f.help}</span>}
                <div className="mt-1.5 flex items-center gap-2">
                  <input id={id} value={answers[f.key] ?? ""} onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })} disabled={closed} inputMode="decimal" maxLength={40} aria-describedby={f.help ? `${id}-help` : undefined} aria-invalid={failed.has(f.label) || undefined} className={FIELD} />
                  <span className="shrink-0 font-lp-mono text-[12.5px] text-app-muted">{f.unit}</span>
                </div>
              </div>
            );
          })}
        </div>
        {!closed && (
          <button type="button" onClick={() => onSubmit({ answers })} disabled={submitting || !complete} className="mt-4 flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />} Submit
          </button>
        )}
      </section>
    </div>
  );
}
