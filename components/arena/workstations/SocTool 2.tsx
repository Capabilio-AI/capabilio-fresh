"use client";

import { useState } from "react";
import { Loader2, Search, Send, ShieldAlert } from "lucide-react";
import { ACTIONS, DISPOSITIONS, LOG_SOURCES, SEVERITIES, TECHNIQUES, type AlertAnswer, type SocContent } from "@/lib/workplace/soc/types";
import { useDraft, type ToolProps } from "./useDraft";

const FIELD = "mt-1.5 w-full rounded-lg border border-app-border bg-white px-3 py-2 font-lp-body text-[13.5px] font-normal text-app-charcoal outline-none focus:ring-2 focus:ring-app-charcoal/15";
const LABEL = "block font-lp-body text-[13px] font-semibold text-app-charcoal";
const MAX_SHOWN = 400;

/**
 * SOC Console: an alert queue, a client-side search over the shift's synthetic logs, and a decision per alert. Searching is free and never graded;
 * only the decisions are sent, and the server checks them against a key this page never receives.
 */
export function SocTool({ attemptId, content, closed, submitting, onSubmit }: ToolProps<SocContent>) {
  const [answers, setAnswers] = useDraft<Record<string, AlertAnswer>>(attemptId, "answers", {});
  const [note, setNote] = useDraft(attemptId, "note", "");
  const [selected, setSelected] = useState(content.alerts[0]?.id ?? "");
  const [query, setQuery] = useState("");
  const [source, setSource] = useState("");

  const asks = (f: SocContent["ask"][number]) => content.ask.includes(f);
  const current = answers[selected] ?? {};
  const update = (patch: AlertAnswer) => setAnswers({ ...answers, [selected]: { ...current, ...patch } });
  const cited = new Set(current.evidence ?? []);
  const toggleCite = (id: string) => update({ evidence: cited.has(id) ? [...cited].filter((x) => x !== id) : [...cited, id] });

  const terms = query.toLowerCase().split(/\s+/).filter(Boolean);
  const matches = content.logs.filter((l) => (!source || l.source === source) && terms.every((t) => `${l.id} ${l.ts} ${l.source} ${l.host} ${l.user} ${l.event} ${l.detail}`.toLowerCase().includes(t)));
  const complete = content.alerts.every((a) => !!answers[a.id]?.disposition);
  const alert = content.alerts.find((a) => a.id === selected);

  return (
    <div className="flex flex-col gap-4">
      <p className="rounded-lg border border-app-border bg-app-background px-4 py-2 font-lp-body text-[12px] text-app-muted">{content.notice}</p>

      <div className="flex flex-col gap-4 lg:flex-row">
        <aside className="flex shrink-0 flex-col gap-3 lg:w-[280px]">
          <section aria-labelledby="soc-queue-h">
            <h3 id="soc-queue-h" className="flex items-center gap-1.5 font-lp-body text-[12px] font-semibold text-app-charcoal"><ShieldAlert size={13} aria-hidden /> Alert queue · {content.shiftDate}</h3>
            <ul className="mt-2 flex flex-col gap-2">
              {content.alerts.map((a) => (
                <li key={a.id}>
                  <button type="button" aria-pressed={a.id === selected} onClick={() => setSelected(a.id)} className={`w-full rounded-lg border px-3 py-2 text-left ${a.id === selected ? "border-app-charcoal bg-white" : "border-app-border bg-white/60"}`}>
                    <span className="flex items-center justify-between font-lp-mono text-[11.5px] text-app-muted"><span>{a.id}</span><span>{a.ts.slice(11, 16)}{answers[a.id]?.disposition ? " · decided" : ""}</span></span>
                    <span className="mt-0.5 block font-lp-body text-[12.5px] font-semibold text-app-charcoal">{a.rule}</span>
                  </button>
                </li>
              ))}
            </ul>
          </section>
          <details className="rounded-lg border border-app-border bg-white px-3 py-2">
            <summary className="cursor-pointer font-lp-body text-[12px] font-semibold text-app-charcoal">Assets and known infrastructure</summary>
            <dl className="mt-2 flex flex-col gap-1.5">
              {content.assets.map((x) => <div key={x.name}><dt className="font-lp-mono text-[11.5px] text-app-charcoal">{x.name}</dt><dd className="font-lp-body text-[11.5px] text-app-muted">{x.detail}</dd></div>)}
            </dl>
          </details>
          <details className="rounded-lg border border-app-border bg-white px-3 py-2">
            <summary className="cursor-pointer font-lp-body text-[12px] font-semibold text-app-charcoal">Team runbook</summary>
            <ul className="mt-2 flex list-disc flex-col gap-1 pl-4 font-lp-body text-[11.5px] text-app-muted">{content.runbook.map((r) => <li key={r}>{r}</li>)}</ul>
          </details>
        </aside>

        <section aria-labelledby="soc-logs-h" className="flex min-w-0 flex-1 flex-col gap-2">
          <h3 id="soc-logs-h" className="font-lp-body text-[12px] font-semibold text-app-charcoal">Log search ({content.logs.length} lines, searched in your browser)</h3>
          <div className="flex flex-wrap gap-2">
            <label className="relative min-w-[200px] flex-1">
              <span className="sr-only">Search logs</span>
              <Search size={14} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
              <input value={query} onChange={(e) => setQuery(e.target.value)} placeholder="user, host, IP, event… (all words must match)" className={`${FIELD} mt-0 pl-8`} />
            </label>
            <label>
              <span className="sr-only">Log source</span>
              <select value={source} onChange={(e) => setSource(e.target.value)} className={`${FIELD} mt-0`}>
                <option value="">All sources</option>
                {LOG_SOURCES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </label>
          </div>
          <p className="font-lp-body text-[11.5px] text-app-muted">{matches.length} matching lines{matches.length > MAX_SHOWN ? `, first ${MAX_SHOWN} shown` : ""}.{asks("evidence") && alert ? ` Tick a line to cite it as evidence for ${alert.id}.` : ""}</p>
          <div className="max-h-[420px] overflow-auto rounded-xl border border-app-border bg-white">
            <table className="w-full font-lp-mono text-[11.5px] text-app-charcoal">
              <thead className="sticky top-0 bg-app-background text-left text-app-muted">
                <tr>{asks("evidence") && <th className="px-2 py-1.5"><span className="sr-only">Cite</span></th>}<th className="px-2 py-1.5">id</th><th className="px-2 py-1.5">time</th><th className="px-2 py-1.5">source</th><th className="px-2 py-1.5">host</th><th className="px-2 py-1.5">user</th><th className="px-2 py-1.5">event</th><th className="px-2 py-1.5">detail</th></tr>
              </thead>
              <tbody>
                {matches.slice(0, MAX_SHOWN).map((l) => (
                  <tr key={l.id} className={`border-t border-app-border align-top ${cited.has(l.id) ? "bg-app-background" : ""}`}>
                    {asks("evidence") && <td className="px-2 py-1"><input type="checkbox" checked={cited.has(l.id)} onChange={() => toggleCite(l.id)} disabled={closed} aria-label={`Cite ${l.id} for ${selected}`} /></td>}
                    <td className="px-2 py-1">{l.id}</td><td className="whitespace-nowrap px-2 py-1">{l.ts.slice(11, 19)}</td><td className="px-2 py-1">{l.source}</td><td className="px-2 py-1">{l.host}</td><td className="px-2 py-1">{l.user}</td><td className="px-2 py-1">{l.event}</td><td className="break-all px-2 py-1">{l.detail}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {alert && (
        <section aria-labelledby="soc-decision-h" className="rounded-xl border border-app-border bg-white p-5">
          <h3 id="soc-decision-h" className="font-lp-display text-[18px] font-bold text-app-charcoal">Decision for {alert.id}</h3>
          <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{alert.summary} Host {alert.host}, user {alert.user}.</p>
          <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-2">
            <label className={LABEL}>Disposition
              <select value={current.disposition ?? ""} onChange={(e) => update({ disposition: e.target.value || undefined })} disabled={closed} className={FIELD}>
                <option value="">Choose…</option>
                {DISPOSITIONS.map((d) => <option key={d.key} value={d.key}>{d.label}</option>)}
              </select>
            </label>
            {asks("severity") && (
              <label className={LABEL}>Severity
                <select value={current.severity ?? ""} onChange={(e) => update({ severity: e.target.value || undefined })} disabled={closed} className={FIELD}>
                  <option value="">Choose…</option>
                  {SEVERITIES.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </label>
            )}
            {asks("technique") && (
              <label className={LABEL}>MITRE ATT&amp;CK technique <span className="font-normal text-app-muted">(checked for true positives)</span>
                <select value={current.technique ?? ""} onChange={(e) => update({ technique: e.target.value || undefined })} disabled={closed} className={FIELD}>
                  <option value="">Not applicable / choose…</option>
                  {TECHNIQUES.map((t) => <option key={t.id} value={t.id}>{t.id} {t.name}</option>)}
                </select>
              </label>
            )}
            {asks("action") && (
              <label className={LABEL}>Containment action
                <select value={current.action ?? ""} onChange={(e) => update({ action: e.target.value || undefined })} disabled={closed} className={FIELD}>
                  <option value="">Choose…</option>
                  {ACTIONS.map((a) => <option key={a.key} value={a.key}>{a.label}</option>)}
                </select>
              </label>
            )}
            {asks("escalate") && (
              <fieldset className={LABEL}>
                <legend>Escalate to L2?</legend>
                <div className="mt-2 flex gap-4 font-normal">
                  {[true, false].map((v) => (
                    <label key={String(v)} className="flex items-center gap-1.5"><input type="radio" name={`escalate-${alert.id}`} checked={current.escalate === v} onChange={() => update({ escalate: v })} disabled={closed} /> {v ? "Yes" : "No"}</label>
                  ))}
                </div>
              </fieldset>
            )}
            {asks("evidence") && (
              <div className={LABEL}>Evidence cited
                <p className="mt-1.5 font-lp-mono text-[12px] font-normal text-app-muted">{cited.size ? [...cited].sort().join(", ") : "None yet: tick lines in the log search."}</p>
              </div>
            )}
          </div>
        </section>
      )}

      {!closed && (
        <section className="rounded-xl border border-app-border bg-white p-5">
          <label className={LABEL}>
            Findings note <span className="font-normal text-app-muted">(what you saw and why; not graded, used when you explain your work)</span>
            <textarea value={note} onChange={(e) => setNote(e.target.value)} rows={3} maxLength={2000} className={FIELD} />
          </label>
          <button type="button" onClick={() => onSubmit({ alerts: answers, note: note.trim() || undefined })} disabled={submitting || !complete} className="mt-4 flex items-center gap-1.5 rounded-lg bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white disabled:opacity-50">
            {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden /> : <Send size={14} aria-hidden />} Submit decisions
          </button>
          {!complete && <p className="mt-2 font-lp-body text-[12px] text-app-muted">Give every alert in the queue a disposition to submit.</p>}
        </section>
      )}
    </div>
  );
}
