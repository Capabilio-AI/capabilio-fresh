import type { ReactNode } from "react";
import { Plus } from "lucide-react";

export function PageHeader({ title, subtitle, action }: { title: string; subtitle?: string; action?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div>
        <h1 className="o-serif text-[30px] leading-[1.1] text-app-charcoal md:text-[34px]">{title}</h1>
        {subtitle && <p className="mt-2 max-w-2xl font-lp-body text-[13px] leading-relaxed text-app-muted">{subtitle}</p>}
      </div>
      {action}
    </div>
  );
}

export function Panel({ title, children, className = "" }: { title?: string; children: ReactNode; className?: string }) {
  return (
    <section className={`o-card p-5 ${className}`}>
      {title && <h2 className="mb-3 font-lp-body text-[13px] font-extrabold text-app-charcoal">{title}</h2>}
      {children}
    </section>
  );
}

export function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="rounded-2xl border border-dashed border-app-border px-6 py-9 text-center">
      <p className="font-lp-body text-[14px] font-bold text-app-charcoal">{title}</p>
      <p className="mx-auto mt-1 max-w-md font-lp-body text-[12.5px] leading-relaxed text-app-muted">{body}</p>
    </div>
  );
}

const PILL = {
  neutral: "bg-white/[0.07] text-app-muted",
  ok: "bg-app-success-container text-app-success",
  warn: "bg-app-warning-container text-app-warning",
  info: "bg-app-blue-container text-app-blue",
  bad: "bg-app-rose-container text-app-rose",
} as const;

/** Printed-stamp look in the staff workspace (`.ws-stamp`); a plain pill on the dark public page. */

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: keyof typeof PILL }) {
  return <span className={`ws-stamp inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-1 font-lp-body text-[10.5px] font-extrabold ${PILL[tone]}`}>{children}</span>;
}

export function Stat({ label, value, hint, tone = "text-app-charcoal" }: { label: string; value: ReactNode; hint?: string; tone?: string }) {
  return (
    <div className="o-card p-4">
      <p className="o-eyebrow">{label}</p>
      <p className={`mt-2.5 font-lp-body text-[32px] font-black leading-none tracking-[-0.04em] ${tone}`}>{value}</p>
      {hint && <p className="mt-1.5 font-lp-body text-[11.5px] text-app-muted">{hint}</p>}
    </div>
  );
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" });
}

/** Add-forms sit behind a button so lists lead the page; native <details>, so it works without JavaScript. */
export function Collapsible({ title, children, defaultOpen = false }: { title: string; children: ReactNode; defaultOpen?: boolean }) {
  return (
    <details open={defaultOpen} className="o-card group [&_summary::-webkit-details-marker]:hidden">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-5 py-4">
        <span className="text-[13px] font-extrabold text-app-charcoal">{title}</span>
        <span className="pointer-events-none group-open:hidden">
          <span className="o-btn-ghost !py-1.5">
            <Plus size={14} aria-hidden="true" /> New
          </span>
        </span>
        <span className="pointer-events-none hidden group-open:block">
          <span className="o-btn-ghost !py-1.5">Close</span>
        </span>
      </summary>
      <div className="border-t border-app-border p-5">{children}</div>
    </details>
  );
}
