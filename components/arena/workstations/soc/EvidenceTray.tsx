import { X } from "lucide-react";
import type { LogLine } from "@/lib/workplace/soc/types";
import { FOCUS, H, SOURCE_COLOR } from "./theme";

interface Props {
  lines: LogLine[];
  disabled: boolean;
  onRemove: (id: string) => void;
}

/** The log lines cited for the selected alert, in time order, each removable. */
export function EvidenceTray({ lines, disabled, onRemove }: Props) {
  return (
    <div>
      <h4 className={H}>Evidence cited ({lines.length})</h4>
      {lines.length === 0 ? (
        <p className="mt-1.5 font-lp-body text-[12px] text-[var(--soc-muted)]">None yet. Select a log line and press c, or use its tick box.</p>
      ) : (
        <ul className="mt-1.5 flex max-h-[170px] flex-col gap-1 overflow-auto">
          {lines.map((l) => (
            <li key={l.id} className="flex items-start gap-1.5 rounded-md border border-[var(--soc-line)] bg-[var(--soc-bg)] px-2 py-1 font-lp-mono text-[11px] text-[var(--soc-text)]">
              <span className="min-w-0 flex-1 break-words">
                <span className="text-[var(--soc-muted)]">{l.id} {l.ts.slice(11, 19)}</span>{" "}
                <span style={{ color: SOURCE_COLOR[l.source] }}>{l.source}</span> {l.event}
              </span>
              <button type="button" disabled={disabled} onClick={() => onRemove(l.id)} aria-label={`Remove ${l.id} from evidence`} className={`shrink-0 rounded p-0.5 text-[var(--soc-muted)] hover:text-[var(--soc-text)] disabled:opacity-40 ${FOCUS}`}><X size={12} aria-hidden /></button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
