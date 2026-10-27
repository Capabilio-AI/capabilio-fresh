import { BookOpen, Server, X } from "lucide-react";
import type { SocContent } from "@/lib/workplace/soc/types";
import { BTN, FOCUS, H, PANEL } from "./theme";

export function AssetPanel({ assets, onPivot }: { assets: SocContent["assets"]; onPivot: (name: string) => void }) {
  return (
    <section aria-labelledby="soc-assets-h" className={`${PANEL} p-2.5`}>
      <h3 id="soc-assets-h" className={`${H} flex items-center gap-1.5`}><Server size={12} aria-hidden /> Assets and infrastructure</h3>
      <ul className="mt-2 flex max-h-[260px] flex-col gap-1 overflow-auto">
        {assets.map((x) => (
          <li key={x.name} className="rounded-md border border-[var(--soc-line)] bg-[var(--soc-bg)] px-2 py-1.5">
            <button type="button" onClick={() => onPivot(x.name)} aria-label={`Filter logs to ${x.name}`} className={`font-lp-mono text-[11.5px] text-[var(--soc-accent)] underline decoration-dotted underline-offset-2 ${FOCUS}`}>{x.name}</button>
            <p className="font-lp-body text-[11.5px] leading-snug text-[var(--soc-muted)]">{x.detail}</p>
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Slide-over inside the console. Closed it is removed from the tab order entirely. */
export function RunbookDrawer({ open, onClose, items }: { open: boolean; onClose: () => void; items: string[] }) {
  return (
    <aside id="soc-runbook" aria-label="Team runbook" hidden={!open} className="absolute inset-y-0 right-0 z-20 w-full max-w-[380px] overflow-auto border-l border-[var(--soc-line)] bg-[var(--soc-panel)] p-4 shadow-2xl motion-safe:animate-[soc-slide_160ms_ease-out]">
      <div className="flex items-center justify-between">
        <h3 className={`${H} flex items-center gap-1.5`}><BookOpen size={12} aria-hidden /> Team runbook</h3>
        <button type="button" onClick={onClose} aria-label="Close runbook" className={`${BTN} px-1.5`}><X size={14} aria-hidden /></button>
      </div>
      <ol className="mt-3 flex flex-col gap-2.5">
        {items.map((r, i) => (
          <li key={r} className="flex gap-2.5 font-lp-body text-[12.5px] leading-relaxed text-[var(--soc-text)]">
            <span className="mt-px shrink-0 font-lp-mono text-[11px] text-[var(--soc-muted)]">{String(i + 1).padStart(2, "0")}</span>
            {r}
          </li>
        ))}
      </ol>
      <style>{`@keyframes soc-slide{from{transform:translateX(24px);opacity:0}to{transform:none;opacity:1}}`}</style>
    </aside>
  );
}
