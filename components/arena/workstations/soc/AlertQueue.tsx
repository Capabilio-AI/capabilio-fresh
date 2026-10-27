import { ShieldAlert } from "lucide-react";
import type { AlertAnswer, PublicAlert, SocField } from "@/lib/workplace/soc/types";
import { decisionProgress } from "./helpers";
import { FOCUS, H, PANEL, SEVERITY_STYLE } from "./theme";

/** Severity pill: shows the analyst's own triage (never a verdict from the server), or "untriaged". */
export function SeverityPill({ severity }: { severity?: string }) {
  const s = severity ? SEVERITY_STYLE[severity] : undefined;
  return (
    <span className="inline-flex items-center gap-1 rounded border px-1.5 py-px font-lp-mono text-[10.5px] font-semibold uppercase" style={{ color: s?.color ?? "var(--soc-muted)", borderColor: s?.color ?? "var(--soc-line)", background: "rgba(255,255,255,0.03)" }}>
      <span aria-hidden>{s?.glyph ?? "○"}</span>
      {severity ?? "untriaged"}
    </span>
  );
}

export function StatusChip({ done, total }: { done: number; total: number }) {
  const label = done === 0 ? "New" : done >= total ? "Decided" : "In progress";
  const color = done === 0 ? "var(--soc-info)" : done >= total ? "var(--soc-ok)" : "var(--soc-med)";
  return (
    <span className="inline-flex items-center gap-1 font-lp-mono text-[10.5px] font-semibold" style={{ color }}>
      <span aria-hidden>{done >= total ? "✓" : done === 0 ? "◌" : "◐"}</span>
      {label} {done}/{total}
    </span>
  );
}

interface Props {
  alerts: PublicAlert[];
  answers: Record<string, AlertAnswer>;
  ask: readonly SocField[];
  selected: string;
  onSelect: (id: string) => void;
  shiftDate: string;
}

export function AlertQueue({ alerts, answers, ask, selected, onSelect, shiftDate }: Props) {
  return (
    <section aria-labelledby="soc-queue-h" className={`${PANEL} p-2.5`}>
      <h3 id="soc-queue-h" className={`${H} flex items-center gap-1.5`}>
        <ShieldAlert size={12} aria-hidden /> Alert queue · {shiftDate}
      </h3>
      <ul className="mt-2 flex flex-col gap-1.5">
        {alerts.map((a) => {
          const p = decisionProgress(answers[a.id], ask);
          const active = a.id === selected;
          return (
            <li key={a.id}>
              <button
                type="button"
                aria-pressed={active}
                onClick={() => onSelect(a.id)}
                className={`w-full rounded-md border border-l-4 px-2.5 py-2 text-left motion-safe:transition-colors ${FOCUS} ${active ? "border-[var(--soc-accent)] bg-[var(--soc-raised)]" : "border-[var(--soc-line)] bg-[var(--soc-bg)] hover:bg-[var(--soc-raised)]"}`}
                style={{ borderLeftColor: SEVERITY_STYLE[answers[a.id]?.severity ?? ""]?.color ?? "var(--soc-line)" }}
              >
                <span className="flex items-center justify-between gap-2 font-lp-mono text-[11px] text-[var(--soc-muted)]">
                  <span>{a.id}</span>
                  <span>{a.ts.slice(11, 16)}</span>
                </span>
                <span className="mt-0.5 block font-lp-body text-[12.5px] font-semibold leading-snug text-[var(--soc-text)]">{a.rule}</span>
                <span className="mt-1.5 flex flex-wrap items-center justify-between gap-1.5">
                  <SeverityPill severity={answers[a.id]?.severity} />
                  <StatusChip done={p.done} total={p.total} />
                </span>
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
