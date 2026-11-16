import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowDownRight, ArrowUpRight, Download } from "lucide-react";
import clsx from "clsx";

export const CARD = "rounded-2xl border border-[var(--m-rule)] bg-white";

export function PageHeader({ eyebrow, title, intro, actions }: { eyebrow?: string; title: string; intro?: string; actions?: ReactNode }) {
  return (
    <header className="mb-6 flex flex-wrap items-end justify-between gap-4">
      <div className="min-w-0">
        {eyebrow && <p className="font-lp-body text-[11.5px] font-bold uppercase tracking-[0.16em] text-[var(--m-accent-ink)]">{eyebrow}</p>}
        <h1 className="mt-1 font-lp-display text-[30px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] sm:text-[38px]">{title}</h1>
        {intro && <p className="mt-2 max-w-[62ch] font-lp-body text-[14px] leading-relaxed text-[var(--m-muted)]">{intro}</p>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </header>
  );
}

export function ExportLink({ kind, query, label = "Export CSV" }: { kind: string; query?: string; label?: string }) {
  return (
    <a href={`/api/admin/export/${kind}${query ? `?${query}` : ""}`} className="inline-flex items-center gap-2 rounded-full border border-[var(--m-rule)] bg-white px-4 py-2 font-lp-body text-[13px] font-bold text-[var(--m-ink)] transition-colors hover:border-[var(--m-ink)]">
      <Download size={14} aria-hidden /> {label}
    </a>
  );
}

const TONE: Record<string, string> = {
  ink: "bg-[var(--m-ink)] text-white",
  accent: "bg-[var(--m-accent)] text-white",
  plain: "bg-white text-[var(--m-ink)] border border-[var(--m-rule)]",
};

/** A headline number. `tone="ink"` is the dark hero tile; a link makes the whole tile a door into that section. */
export function Stat({ label, value, sub, href, tone = "plain", children }: { label: string; value: ReactNode; sub?: ReactNode; href?: string; tone?: "ink" | "accent" | "plain"; children?: ReactNode }) {
  const inner = (
    <div className={clsx("flex h-full flex-col rounded-2xl p-5 transition-transform", TONE[tone], href && "hover:-translate-y-0.5")}>
      <p className={clsx("font-lp-body text-[12px] font-bold uppercase tracking-[0.12em]", tone === "plain" ? "text-[var(--m-muted)]" : "text-white/70")}>{label}</p>
      <p className="mt-2 font-lp-display text-[40px] font-bold leading-none tabular-nums tracking-tight">{value}</p>
      {sub && <p className={clsx("mt-2 font-lp-body text-[12.5px]", tone === "plain" ? "text-[var(--m-muted)]" : "text-white/75")}>{sub}</p>}
      {children}
    </div>
  );
  return href ? <Link href={href} className="block h-full">{inner}</Link> : inner;
}

/** Inline-SVG sparkline from a list of counts. No chart library: it is a line, a fill and a dot on today. */
export function Spark({ values, className, label }: { values: readonly number[]; className?: string; label: string }) {
  const w = 220, h = 56, pad = 4;
  const max = Math.max(1, ...values);
  const x = (i: number) => pad + (i * (w - pad * 2)) / Math.max(1, values.length - 1);
  const y = (v: number) => h - pad - (v / max) * (h - pad * 2);
  const pts = values.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`);
  const last = values.length - 1;
  return (
    <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label={label} className={clsx("w-full", className)} preserveAspectRatio="none">
      <polygon points={`${x(0)},${h - pad} ${pts.join(" ")} ${x(last)},${h - pad}`} fill="var(--m-accent-soft)" />
      <polyline points={pts.join(" ")} fill="none" stroke="var(--m-accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
      <circle cx={x(last)} cy={y(values[last] ?? 0)} r="3.5" fill="var(--m-accent)" />
    </svg>
  );
}

export function Delta({ now, before }: { now: number; before: number }) {
  if (before === 0 && now === 0) return <span className="text-[12px] text-[var(--m-muted)]">no change</span>;
  const pct = before === 0 ? 100 : Math.round(((now - before) / before) * 100);
  const up = pct >= 0;
  return (
    <span className={clsx("inline-flex items-center gap-0.5 text-[12px] font-bold", up ? "text-[#0f7a52]" : "text-[#b4232f]")}>
      {up ? <ArrowUpRight size={13} aria-hidden /> : <ArrowDownRight size={13} aria-hidden />}{Math.abs(pct)}% vs the week before
    </span>
  );
}

/** Horizontal bars for a short list: value against the largest value (or a given total). */
export function Bars({ rows, total, empty = "Nothing yet." }: { rows: { label: string; value: number; note?: string }[]; total?: number; empty?: string }) {
  const max = total ?? Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="font-lp-body text-[13px] text-[var(--m-muted)]">{empty}</p>;
  return (
    <ul className="flex flex-col gap-2.5">
      {rows.map((r) => (
        <li key={r.label}>
          <div className="flex items-baseline justify-between gap-3 font-lp-body text-[13px]">
            <span className="min-w-0 truncate font-semibold text-[var(--m-ink)]">{r.label}</span>
            <span className="shrink-0 tabular-nums text-[var(--m-muted)]">{r.value}{r.note ? ` · ${r.note}` : ""}</span>
          </div>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-[var(--m-ground)]"><div className="h-full rounded-full bg-[var(--m-accent)]" style={{ width: `${Math.max(2, Math.round((r.value / max) * 100))}%` }} /></div>
        </li>
      ))}
    </ul>
  );
}

const CHIP: Record<string, string> = {
  active: "bg-[#dff5ea] text-[#0b5d3f]", approved: "bg-[#dff5ea] text-[#0b5d3f]", verified: "bg-[#dff5ea] text-[#0b5d3f]", sent: "bg-[#dff5ea] text-[#0b5d3f]",
  pending: "bg-[#fff0cf] text-[#7a5200]", hold: "bg-[#e6e3fb] text-[#3d2fb0]", interested: "bg-[#e6e3fb] text-[#3d2fb0]",
  rejected: "bg-[#fde3e8] text-[#8e1228]", revoked: "bg-[#fde3e8] text-[#8e1228]", failed: "bg-[#fde3e8] text-[#8e1228]", suspended: "bg-[#fde3e8] text-[#8e1228]", deactivated: "bg-[#fde3e8] text-[#8e1228]",
};
export function Chip({ children, tone }: { children: ReactNode; tone?: string }) {
  const key = tone ?? (typeof children === "string" ? children.toLowerCase() : "");
  return <span className={clsx("inline-flex items-center rounded-full px-2.5 py-0.5 font-lp-body text-[11.5px] font-bold capitalize", CHIP[key] ?? "bg-[var(--m-ground)] text-[var(--m-muted)]")}>{children}</span>;
}

export const TH = "px-4 py-2.5 text-left font-lp-body text-[11.5px] font-bold uppercase tracking-[0.1em] text-[var(--m-muted)]";
export const TD = "px-4 py-3 font-lp-body text-[13.5px] text-[var(--m-ink)]";

export function Table({ head, children, empty }: { head: string[]; children: ReactNode; empty?: ReactNode }) {
  return (
    <div className={clsx(CARD, "overflow-x-auto")}>
      <table className="w-full min-w-[640px] border-collapse">
        <thead><tr className="border-b border-[var(--m-rule)] bg-[var(--m-ground)]/60">{head.map((h) => <th key={h} className={TH} scope="col">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-[var(--m-rule)]">{children}</tbody>
      </table>
      {empty}
    </div>
  );
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border border-dashed border-[var(--m-soft)] bg-white px-6 py-12 text-center">
      <p className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{title}</p>
      {children && <p className="mx-auto mt-1 max-w-md font-lp-body text-[13.5px] text-[var(--m-muted)]">{children}</p>}
    </div>
  );
}

export function Section({ title, hint, children, action }: { title: string; hint?: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className={clsx(CARD, "p-5")}>
      <div className="mb-4 flex items-start justify-between gap-3">
        <div><h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{title}</h2>{hint && <p className="mt-0.5 font-lp-body text-[12.5px] text-[var(--m-muted)]">{hint}</p>}</div>
        {action}
      </div>
      {children}
    </section>
  );
}

export const when = (iso: string | null | undefined) => (iso ? new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—");
export const whenTime = (iso: string) => new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
export const humanise = (s: string) => s.replace(/_/g, " ");
