"use client";

import { useState } from "react";
import { CheckCircle2, Circle, Loader2, Play, Send } from "lucide-react";
import { parseSpec, SPEC_REFERENCE } from "@/lib/workplace/pipeline/spec";
import { simulate, type RunLog, type Simulation } from "@/lib/workplace/pipeline/simulate";
import type { PipelineContent } from "@/lib/workplace/pipeline/templates";
import { useDraft, type ToolProps } from "./useDraft";

type Preview = { error: string } | { sim: Simulation };

const STATUS_STYLE: Record<RunLog["status"], string> = { success: "text-app-green", failed: "text-app-rose", blocked: "text-app-warning" };

function Runs({ title, runs }: { title: string; runs: RunLog[] }) {
  return (
    <div className="overflow-x-auto">
      <h4 className="font-lp-body text-[12px] font-semibold text-app-charcoal">{title}</h4>
      <table className="mt-1 w-full border-collapse font-lp-mono text-[11.5px]">
        <thead>
          <tr className="text-left text-app-muted">
            <th className="py-1 pr-3 font-normal">Run</th><th className="py-1 pr-3 font-normal">Status</th><th className="py-1 pr-3 font-normal">Tries</th>
            <th className="py-1 pr-3 font-normal">Read</th><th className="py-1 pr-3 font-normal">Dupes dropped</th><th className="py-1 pr-3 font-normal">Written</th><th className="py-1 font-normal">Note</th>
          </tr>
        </thead>
        <tbody>
          {runs.map((r) => (
            <tr key={r.label} className="border-t border-app-border text-app-charcoal">
              <td className="py-1 pr-3">{r.label}</td><td className={`py-1 pr-3 ${STATUS_STYLE[r.status]}`}>{r.status}</td><td className="py-1 pr-3">{r.attempts}</td>
              <td className="py-1 pr-3">{r.extracted}</td><td className="py-1 pr-3">{r.duplicatesDropped}</td><td className="py-1 pr-3">{r.written}</td><td className="py-1 text-app-muted">{r.reason ?? ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Result({ sim }: { sim: Simulation }) {
  const s = sim.summary;
  return (
    <div className="flex flex-col gap-3">
      <Runs title="Daily runs" runs={sim.runs} />
      <Runs title="Backfill (every day re-run on top of the table)" runs={sim.backfill} />
      <dl className="grid grid-cols-2 gap-x-4 gap-y-1 font-lp-mono text-[11.5px] text-app-charcoal sm:grid-cols-3">
        <div><dt className="text-app-muted">Rows in table</dt><dd>{s.rows}</dd></div>
        <div><dt className="text-app-muted">Repeated keys</dt><dd>{s.duplicateKeys}</dd></div>
        <div><dt className="text-app-muted">Rows with no key</dt><dd>{s.nullKeys}</dd></div>
        <div><dt className="text-app-muted">Same after backfill</dt><dd>{sim.rerunSame ? "yes" : "no"}</dd></div>
        <div><dt className="text-app-muted">Day-2 report reads</dt><dd>{sim.pruning.scanned} of {sim.pruning.total} rows (needs {sim.pruning.needed})</dd></div>
        <div><dt className="text-app-muted">Columns</dt><dd className="break-words">{s.columns.join(", ")}</dd></div>
      </dl>
      <div>
        <h4 className="font-lp-body text-[12px] font-semibold text-app-charcoal">Partitions ({s.partitions.length})</h4>
        <p className="mt-1 font-lp-mono text-[11.5px] text-app-charcoal">{s.partitions.slice(0, 40).map((p) => `${p.value}: ${p.rows}`).join(" · ")}{s.partitions.length > 40 ? " ..." : ""}</p>
      </div>
    </div>
  );
}

/**
 * Pipeline Lab. Edit the spec, run the simulation in the browser (not graded) to see each day's run, the backfill and the table's layout, then submit:
 * the server simulates the same batches again and checks the requirements. A model of Airflow / dbt / Spark ideas; no scheduler or cluster runs.
 */
export function PipelineTool({ attemptId, content, closed, submitting, onSubmit, lastChecks }: ToolProps<PipelineContent>) {
  const [text, setText] = useDraft(attemptId, "spec", content.file.content);
  const [preview, setPreview] = useState<Preview | null>(null);
  const status = new Map((lastChecks ?? []).map((c) => [c.label, c.passed]));

  function run() {
    const parsed = parseSpec(text);
    if (!parsed.ok) return setPreview({ error: parsed.error });
    const sim = simulate(parsed.spec, content.scenario);
    setPreview(sim.errors.length ? { error: sim.errors.join("; ") } : { sim });
  }

  return (
    <div className="flex flex-col gap-4 lg:flex-row">
      <aside className="flex shrink-0 flex-col gap-4 lg:w-[320px]">
        <section>
          <h3 className="font-lp-body text-[12px] font-semibold text-app-charcoal">Your pipeline must meet these requirements</h3>
          <ul className="mt-2 flex flex-col gap-2">
            {content.requirements.map((r) => {
              const known = status.get(r);
              return (
                <li key={r} className="flex items-start gap-2 font-lp-body text-[12.5px] text-app-charcoal">
                  {known === true ? <CheckCircle2 size={14} className="mt-0.5 shrink-0 text-app-green" aria-label="met" /> : <Circle size={14} className={`mt-0.5 shrink-0 ${known === false ? "text-app-rose" : "text-app-muted"}`} aria-label={known === false ? "not met" : "not checked yet"} />}
                  <span>{r}</span>
                </li>
              );
            })}
          </ul>
          <p className="mt-2 font-lp-body text-[12px] text-app-muted">You have {content.maxSubmissions} tries.</p>
        </section>
        <section>
          <h3 className="font-lp-body text-[12px] font-semibold text-app-charcoal">What lands in {content.scenario.dataset.source}</h3>
          <ul className="mt-1.5 flex flex-col gap-1.5">
            {content.days.map((d) => <li key={d} className="font-lp-body text-[12.5px] leading-relaxed text-app-charcoal">{d}</li>)}
          </ul>
        </section>
        <section>
          <h3 className="font-lp-body text-[12px] font-semibold text-app-charcoal">Spec reference</h3>
          <ul className="mt-1.5 flex flex-col gap-1">
            {SPEC_REFERENCE.map((l) => <li key={l} className="font-lp-mono text-[11px] leading-relaxed text-app-muted">{l}</li>)}
          </ul>
        </section>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col gap-3">
        <div className="overflow-hidden rounded-xl border border-[#2a2a2a] bg-[#161616]">
          <div className="border-b border-[#2a2a2a] px-4 py-2 font-lp-mono text-[11px] text-white/50">{content.file.name}</div>
          <textarea value={text} onChange={(e) => setText(e.target.value)} spellCheck={false} wrap="off" aria-label={`Editor for ${content.file.name}`} disabled={closed} className="block h-[380px] w-full resize-y overflow-auto bg-transparent px-4 py-3 font-lp-mono text-[13px] leading-[1.6] text-[#e8e8e8] caret-app-orange outline-none disabled:opacity-60" />
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={run} className="flex w-fit items-center gap-1.5 rounded-lg border border-app-border bg-white px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal">
            <Play size={14} aria-hidden /> Run simulation
          </button>
          {!closed && (
            <button type="button" disabled={submitting} onClick={() => onSubmit({ spec: text })} className="flex w-fit items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
              {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />} Submit
            </button>
          )}
        </div>
        {preview && (
          <section aria-label="Simulated run" aria-live="polite" className="rounded-xl border border-app-border bg-white p-4">
            <p className="mb-3 font-lp-body text-[12px] text-app-muted">Simulated in your browser over the ticket&apos;s batches. Not graded; Submit is checked on the server.</p>
            {"error" in preview ? <pre className="whitespace-pre-wrap rounded-md bg-app-rose-container px-4 py-3 font-lp-mono text-[12.5px] text-app-rose">{preview.error}</pre> : <Result sim={preview.sim} />}
          </section>
        )}
      </div>
    </div>
  );
}
