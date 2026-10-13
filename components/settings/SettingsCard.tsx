import type { ReactNode } from "react";

/** A titled settings panel. The title is the panel's accessible name, so screen readers can jump between panels. */
export function SettingsCard({ id, title, description, status, children, danger = false, bare = false }: { id: string; title: string; description?: ReactNode; status?: ReactNode; children?: ReactNode; danger?: boolean; bare?: boolean }) {
  return (
    <section aria-labelledby={id} className={`rounded-2xl border bg-[var(--m-sheet)] ${danger ? "border-[#f0c4bf]!" : "border-[var(--m-rule)]!"}`}>
      <header className="flex flex-wrap items-start justify-between gap-x-4 gap-y-2 px-5 pt-5 sm:px-6 sm:pt-6">
        <div className="min-w-0 max-w-[60ch]">
          <h2 id={id} className="font-lp-display text-[18px] font-bold leading-tight tracking-tight text-[var(--m-ink)]">{title}</h2>
          {description && <p className="mt-1.5 font-lp-body text-[13.5px] leading-relaxed text-[var(--m-muted)]">{description}</p>}
        </div>
        {status}
      </header>
      {children ? <div className={bare ? "pt-3" : "px-5 pb-5 pt-4 sm:px-6 sm:pb-6"}>{children}</div> : <div className="pb-5 sm:pb-6" />}
    </section>
  );
}

/** A small status label. Always carries words, so state never rests on colour alone. */
export function StatusPill({ tone, children }: { tone: "on" | "off" | "warn"; children: ReactNode }) {
  const styles = {
    on: "bg-[#e3f4ea] text-[#0f6b3c]",
    off: "bg-[var(--m-ground)] text-[var(--m-muted)]",
    warn: "bg-[#fdf0dc] text-[#8a4b08]",
  } as const;
  return <span className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-1 font-lp-body text-[12px] font-bold ${styles[tone]}`}>{children}</span>;
}
