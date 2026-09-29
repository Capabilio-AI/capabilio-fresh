import type { ReactNode } from "react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">{title}</h1>
        {subtitle && <p className="mt-1 max-w-2xl font-lp-body text-[13px] text-app-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`rounded-xl border border-app-border bg-white p-5 ${className}`}>
      {title && <h2 className="mb-3 font-lp-body text-[14px] font-semibold text-app-charcoal">{title}</h2>}
      {children}
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-xl border border-dashed border-app-border bg-white px-6 py-10 text-center">
      <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{title}</p>
      <p className="mx-auto mt-1 max-w-md font-lp-body text-[12.5px] text-app-muted">{body}</p>
    </div>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "ok" | "warn" }) {
  const tones = {
    neutral: "border-app-border text-app-muted",
    ok: "border-transparent bg-app-success-container text-app-success",
    warn: "border-transparent bg-app-warning-container text-app-warning",
  };
  return <span className={`inline-flex items-center rounded-full border px-2 py-0.5 font-lp-mono text-[10.5px] font-semibold ${tones[tone]}`}>{children}</span>;
}

export function Stat({ label, value, hint }: { label: string; value: ReactNode; hint?: string }) {
  return (
    <div className="rounded-xl border border-app-border bg-white p-4">
      <p className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">{label}</p>
      <p className="mt-1 font-lp-display text-[24px] font-semibold text-app-charcoal">{value}</p>
      {hint && <p className="mt-0.5 font-lp-body text-[11.5px] text-app-muted">{hint}</p>}
    </div>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}
