import { Crosshair } from "lucide-react";
import type { PublicAlert } from "@/lib/workplace/soc/types";
import { FOCUS, H, PANEL } from "./theme";

interface Props {
  alert: PublicAlert;
  onPivot: (field: "host" | "user", value: string) => void;
}

/** The selected alert's fields. Host and user are pivots: one click filters the log view to them. */
export function AlertDetail({ alert, onPivot }: Props) {
  const pivot = "rounded border border-[var(--soc-line)] bg-[var(--soc-bg)] px-1.5 py-px font-lp-mono text-[12px] text-[var(--soc-accent)] underline decoration-dotted underline-offset-2 hover:border-[var(--soc-accent)] " + FOCUS;
  return (
    <section aria-labelledby="soc-detail-h" className={`${PANEL} p-3`}>
      <h3 id="soc-detail-h" className={`${H} flex items-center gap-1.5`}>
        <Crosshair size={12} aria-hidden /> Alert detail · {alert.id}
      </h3>
      <p className="mt-1.5 font-lp-body text-[14px] font-semibold text-[var(--soc-text)]">{alert.rule}</p>
      <p className="mt-1 font-lp-body text-[12.5px] leading-relaxed text-[var(--soc-muted)]">{alert.summary}</p>
      <dl className="mt-2.5 flex flex-wrap items-center gap-x-4 gap-y-1.5 font-lp-mono text-[11.5px] text-[var(--soc-muted)]">
        <div className="flex items-center gap-1.5"><dt>fired</dt><dd className="text-[var(--soc-text)]">{alert.ts.slice(11, 19)}</dd></div>
        <div className="flex items-center gap-1.5">
          <dt>host</dt>
          <dd><button type="button" onClick={() => onPivot("host", alert.host)} className={pivot} aria-label={`Filter logs to host ${alert.host}`}>{alert.host}</button></dd>
        </div>
        <div className="flex items-center gap-1.5">
          <dt>user</dt>
          <dd><button type="button" onClick={() => onPivot("user", alert.user)} className={pivot} aria-label={`Filter logs to user ${alert.user}`}>{alert.user}</button></dd>
        </div>
      </dl>
    </section>
  );
}
