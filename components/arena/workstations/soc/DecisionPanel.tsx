import type { ReactNode } from "react";
import { Loader2, Send } from "lucide-react";
import { ACTIONS, DISPOSITIONS, SEVERITIES, type AlertAnswer, type LogLine, type SocField } from "@/lib/workplace/soc/types";
import { decisionProgress, techniquesByTactic } from "./helpers";
import { EvidenceTray } from "./EvidenceTray";
import { FOCUS, H, INPUT, PANEL, SEVERITY_STYLE } from "./theme";

function Group({ legend, hint, children }: { legend: string; hint?: string; children: ReactNode }) {
  return (
    <fieldset className="min-w-0">
      <legend className={`${H} mb-1.5`}>{legend}{hint && <span className="ml-1.5 font-normal normal-case tracking-normal">{hint}</span>}</legend>
      {children}
    </fieldset>
  );
}

/** One-of-N buttons; pressing the chosen one again clears it. */
function Choice({ options, value, onChange, disabled, tint }: { options: { key: string; label: string }[]; value?: string; onChange: (v: string | undefined) => void; disabled: boolean; tint?: boolean }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((o) => {
        const on = value === o.key;
        const color = tint ? SEVERITY_STYLE[o.key]?.color : undefined;
        return (
          <button key={o.key} type="button" aria-pressed={on} disabled={disabled} onClick={() => onChange(on ? undefined : o.key)} className={`rounded-md border px-2.5 py-1.5 text-left font-lp-body text-[12px] font-semibold disabled:opacity-60 motion-safe:transition-colors ${FOCUS} ${on ? "bg-[var(--soc-raised)] text-[var(--soc-text)]" : "bg-[var(--soc-bg)] text-[var(--soc-muted)] hover:text-[var(--soc-text)]"}`} style={{ borderColor: on ? (color ?? "var(--soc-accent)") : "var(--soc-line)", color: on && color ? color : undefined }}>
            {on && <span aria-hidden className="mr-1">✓</span>}
            {tint && <span aria-hidden className="mr-1">{SEVERITY_STYLE[o.key]?.glyph}</span>}
            {o.label}
          </button>
        );
      })}
    </div>
  );
}

interface Props {
  alertId: string;
  answer: AlertAnswer;
  ask: readonly SocField[];
  logById: Map<string, LogLine>;
  closed: boolean;
  submitting: boolean;
  complete: boolean;
  decidedAlerts: number;
  totalAlerts: number;
  note: string;
  onNote: (v: string) => void;
  onChange: (patch: AlertAnswer) => void;
  onToggleCite: (id: string) => void;
  onSubmit: () => void;
}

const TACTICS = techniquesByTactic();

export function DecisionPanel({ alertId, answer, ask, logById, closed, submitting, complete, decidedAlerts, totalAlerts, note, onNote, onChange, onToggleCite, onSubmit }: Props) {
  const asks = (f: SocField) => ask.includes(f);
  const p = decisionProgress(answer, ask);
  const lines = (answer.evidence ?? []).map((id) => logById.get(id)).filter((l): l is LogLine => !!l).sort((a, b) => a.id.localeCompare(b.id));
  return (
    <section aria-labelledby="soc-decision-h" className={`${PANEL} flex flex-col gap-4 p-3`}>
      <div>
        <h3 id="soc-decision-h" className={H}>Case decision · {alertId}</h3>
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-[var(--soc-bg)]" role="progressbar" aria-valuemin={0} aria-valuemax={p.total} aria-valuenow={p.done} aria-label={`Decisions made for ${alertId}`}>
          <div className="h-full bg-[var(--soc-ok)] motion-safe:transition-[width]" style={{ width: `${(p.done / Math.max(1, p.total)) * 100}%` }} />
        </div>
        <p className="mt-1.5 font-lp-mono text-[11.5px] text-[var(--soc-text)]" aria-live="polite">
          {p.done} of {p.total} decisions made <span className="text-[var(--soc-muted)]">· {decidedAlerts} of {totalAlerts} alerts have a disposition</span>
        </p>
      </div>

      <Group legend="Disposition">
        <Choice options={DISPOSITIONS.map((d) => ({ key: d.key, label: d.label }))} value={answer.disposition} onChange={(v) => onChange({ disposition: v })} disabled={closed} />
      </Group>
      {asks("severity") && (
        <Group legend="Severity">
          <Choice tint options={SEVERITIES.map((s) => ({ key: s, label: s }))} value={answer.severity} onChange={(v) => onChange({ severity: v })} disabled={closed} />
        </Group>
      )}
      {asks("technique") && (
        <label className="block min-w-0">
          <span className={H}>MITRE ATT&amp;CK technique <span className="font-normal normal-case tracking-normal">(checked for true positives)</span></span>
          <select value={answer.technique ?? ""} onChange={(e) => onChange({ technique: e.target.value || undefined })} disabled={closed} className={`${INPUT} mt-1.5`}>
            <option value="">Not applicable / choose…</option>
            {TACTICS.map((g) => (
              <optgroup key={g.tactic} label={g.tactic}>
                {g.items.map((t) => <option key={t.id} value={t.id}>{t.id} {t.name}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      {asks("action") && (
        <Group legend="Containment action">
          <Choice options={ACTIONS.map((a) => ({ key: a.key, label: a.label }))} value={answer.action} onChange={(v) => onChange({ action: v })} disabled={closed} />
        </Group>
      )}
      {asks("escalate") && (
        <Group legend="Escalate to L2?">
          <div className="flex gap-2" role="group" aria-label="Escalate to L2?">
            {[true, false].map((v) => {
              const on = answer.escalate === v;
              return <button key={String(v)} type="button" aria-pressed={on} disabled={closed} onClick={() => onChange({ escalate: v })} className={`flex-1 rounded-md border px-3 py-1.5 font-lp-body text-[12px] font-semibold disabled:opacity-60 ${FOCUS} ${on ? "border-[var(--soc-accent)] bg-[var(--soc-raised)] text-[var(--soc-text)]" : "border-[var(--soc-line)] bg-[var(--soc-bg)] text-[var(--soc-muted)] hover:text-[var(--soc-text)]"}`}>{on && <span aria-hidden>✓ </span>}{v ? "Yes, escalate" : "No"}</button>;
            })}
          </div>
        </Group>
      )}
      {asks("evidence") && <EvidenceTray lines={lines} disabled={closed} onRemove={onToggleCite} />}

      {!closed && (
        <div className="flex flex-col gap-2 border-t border-[var(--soc-line)] pt-3">
          <label className="block">
            <span className={H}>Findings note <span className="font-normal normal-case tracking-normal">(what you saw and why; not graded, used when you explain your work)</span></span>
            <textarea value={note} onChange={(e) => onNote(e.target.value)} rows={3} maxLength={2000} className={`${INPUT} mt-1.5 font-lp-body`} />
          </label>
          <button type="button" onClick={onSubmit} disabled={submitting || !complete} className={`flex items-center justify-center gap-1.5 rounded-md bg-[var(--soc-accent)] px-3 py-2 font-lp-body text-[13px] font-semibold text-[#04121f] hover:brightness-110 disabled:opacity-50 ${FOCUS}`}>
            {submitting ? <Loader2 size={14} className="animate-spin motion-reduce:animate-none" aria-hidden /> : <Send size={14} aria-hidden />} Submit decisions
          </button>
          {!complete && <p className="font-lp-body text-[12px] text-[var(--soc-muted)]">Give every alert in the queue a disposition to submit.</p>}
        </div>
      )}
    </section>
  );
}
