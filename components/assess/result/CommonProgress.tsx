import type { SectionBar } from "@/lib/assess/scoring";

/** The common assessment's section bars (Communication, Basic Programming, and any section enabled later). */
export function CommonProgress({ bars }: { bars: SectionBar[] }) {
  return (
    <section className="glass rounded-3xl p-6" aria-labelledby="common-progress" data-testid="common-progress">
      <h2 id="common-progress" className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">Common assessment</h2>
      <p className="mt-1 text-[13px] text-[var(--m-muted)]">A baseline across skills every role needs. It does not change your role rating.</p>
      <ul className="mt-4 space-y-4">
        {bars.map((b) => (
          <li key={b.section}>
            <div className="flex items-baseline justify-between text-[14.5px] font-bold text-[var(--m-ink)]"><span>{b.label}</span><span className="tabular-nums" data-score>{b.score ?? "—"}<span className="text-[12px] font-normal text-[var(--m-muted)]"> /100</span></span></div>
            <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-[var(--m-ink)]/10" role="meter" aria-label={b.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={b.score ?? 0}>
              <div className="h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${b.score ?? 0}%` }} />
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
