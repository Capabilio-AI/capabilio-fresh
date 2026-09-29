"use client";

import { Loader2, Send } from "lucide-react";
import type { StatisticsContent } from "@/lib/arena-workstations/tools/statistics";
import { DataTable, DownloadCsv } from "./DataTable";
import { useDraft, type ToolProps } from "./useDraft";

function describe(values: number[]) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  return { n: values.length, min: sorted[0], max: sorted[sorted.length - 1] };
}

export function StatisticsTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<StatisticsContent>) {
  const [answers, setAnswers] = useDraft<Record<string, string>>(attemptId, "answers", {});
  const [working, setWorking] = useDraft(attemptId, "working", "");
  const { dataset } = content;

  const fields = content.questions.flatMap((q) => q.fields);
  const complete = fields.every((f) => (answers[f.key] ?? "").trim() !== "");

  return (
    <div className="flex flex-col gap-5">
      <section>
        <div className="mb-1.5 flex items-center justify-between">
          <h3 className="font-lp-body text-[12px] font-semibold text-app-charcoal">
            {dataset.name} · {dataset.rows.length} rows
          </h3>
          <DownloadCsv name={dataset.name} columns={dataset.columns} rows={dataset.rows} />
        </div>
        <DataTable columns={dataset.columns} rows={dataset.rows} maxHeight={280} />
        <div className="mt-2 flex flex-wrap gap-2">
          {dataset.columns
            .map((c, j) => ({ c, s: c.type === "number" ? describe(dataset.rows.map((r) => r[j]).filter((v): v is number => typeof v === "number")) : null }))
            .filter((x) => x.s)
            .map(({ c, s }) => (
              <span key={c.name} className="rounded bg-app-background px-2 py-1 font-lp-mono text-[10.5px] text-app-muted">
                {c.name}: n={s!.n}, range {s!.min}–{s!.max}
              </span>
            ))}
        </div>
      </section>

      <section className="flex flex-col gap-4">
        {content.questions.map((q, i) => (
          <div key={q.id} className="rounded-xl border border-app-border bg-white p-4">
            <p className="font-lp-body text-[13.5px] leading-relaxed text-app-charcoal">
              <span className="mr-1.5 font-semibold">Q{i + 1}.</span>
              {q.text.split("`").map((part, k) => (k % 2 ? <code key={k} className="rounded bg-app-background px-1 font-lp-mono text-[12px]">{part}</code> : part))}
            </p>
            <div className="mt-3 flex flex-wrap gap-3">
              {q.fields.map((f) => (
                <label key={f.key} className="flex flex-col gap-1 font-lp-mono text-[11px] font-semibold text-app-muted">
                  {f.label}
                  {f.kind === "choice" ? (
                    <select
                      value={answers[f.key] ?? ""}
                      disabled={closed}
                      onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })}
                      className="w-40 rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13.5px] text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15"
                    >
                      <option value="">Choose…</option>
                      {f.options.map((o) => (
                        <option key={o}>{o}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      inputMode="decimal"
                      value={answers[f.key] ?? ""}
                      disabled={closed}
                      onChange={(e) => setAnswers({ ...answers, [f.key]: e.target.value })}
                      placeholder={`${f.decimals} decimals`}
                      className="w-40 rounded-lg border border-app-border px-3 py-2 font-lp-mono text-[14px] text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15"
                    />
                  )}
                </label>
              ))}
            </div>
          </div>
        ))}
      </section>

      {!closed && (
        <>
          <label className="block font-lp-body text-[12px] font-semibold text-app-charcoal">
            Your working <span className="font-normal text-app-muted">(optional — method, formulas, interpretation for the requester)</span>
            <textarea value={working} onChange={(e) => setWorking(e.target.value)} rows={4} maxLength={5000} className="mt-2 w-full resize-y rounded-lg border border-app-border bg-white px-3 py-2 font-lp-mono text-[12.5px] font-normal outline-none focus:ring-2 focus:ring-app-charcoal/15" />
          </label>
          <div>
            <button
              type="button"
              onClick={() => onSubmit({ answers, working: working.trim() || undefined })}
              disabled={submitting || !complete}
              className="flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50"
            >
              {submitting ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
              Submit answers
            </button>
            {!complete && <p className="mt-1.5 font-lp-body text-[11.5px] text-app-muted">Answer every field to submit.</p>}
          </div>
        </>
      )}
    </div>
  );
}
