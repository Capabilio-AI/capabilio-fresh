import type { ReactNode } from "react";

export function Section({ id, title, blurb, children }: { id: string; title: string; blurb?: string; children: ReactNode }) {
  return (
    <section aria-labelledby={id}>
      <h2 id={id} className="font-lp-display text-[17px] font-semibold text-app-charcoal">{title}</h2>
      {blurb && <p className="mt-0.5 font-lp-body text-[12.5px] text-app-muted">{blurb}</p>}
      <div className="mt-3">{children}</div>
    </section>
  );
}
/** An honest empty state: says what is missing, never invents content. */
export const Empty = ({ children }: { children: ReactNode }) => (
  <p className="rounded-lg border border-dashed border-app-border bg-white px-4 py-3 font-lp-body text-[12.5px] text-app-muted">{children}</p>
);
export const Card = ({ children }: { children: ReactNode }) => <li className="rounded-xl border border-app-border bg-white p-4">{children}</li>;
export function Bar({ value, label, tone = "bg-app-orange" }: { value: number; label: string; tone?: string }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div role="progressbar" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label={label} className="h-1.5 w-full rounded-full bg-app-background">
      <div className={`h-1.5 rounded-full ${tone}`} style={{ width: `${pct}%` }} />
    </div>
  );
}
export const Pill = ({ children, tone = "bg-app-attention-container text-app-attention" }: { children: ReactNode; tone?: string }) => (
  <span className={`inline-block rounded-full px-2 py-0.5 font-lp-mono text-[10.5px] uppercase ${tone}`}>{children}</span>
);
export const Ext = ({ href, children }: { href: string | null; children: ReactNode }) =>
  href ? <a href={href} target="_blank" rel="noopener noreferrer" className="font-medium text-app-blue hover:underline">{children}<span className="sr-only"> (opens in a new tab)</span></a> : <span className="font-medium text-app-charcoal">{children}</span>;
