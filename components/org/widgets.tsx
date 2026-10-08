import type { ReactNode } from "react";
import Link from "next/link";
import clsx from "clsx";
import { ChevronLeft, ChevronRight } from "lucide-react";

/** Glass segmented control made of real links (filters that live in the URL). */
export function Segmented({ label, tabs }: { label: string; tabs: { label: string; href: string; active: boolean; count?: number }[] }) {
  return (
    <nav aria-label={label} className="-mx-1 overflow-x-auto px-1 py-1">
      <div className="ws-pill inline-flex min-w-max gap-0.5 rounded-full p-1">
        {tabs.map((t) => (
          <Link
            key={t.label}
            href={t.href}
            aria-current={t.active ? "page" : undefined}
            className={clsx(
              "flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-[13px] font-bold transition-[background-color,color,box-shadow] duration-200 motion-reduce:transition-none",
              t.active ? "ws-thumb text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:bg-[#fff]/60 hover:text-[var(--m-ink)]"
            )}
          >
            {t.label}
            {t.count !== undefined && <span className={clsx("rounded-full px-1.5 text-[11px] font-extrabold", t.active ? "bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]" : "text-[var(--m-off)]")}>{t.count}</span>}
          </Link>
        ))}
      </div>
    </nav>
  );
}

/** A thin gold bar showing `value` of `max`. */
export function Meter({ value, max, label, tone = "gold" }: { value: number; max: number; label: string; tone?: "gold" | "ok" | "warn" }) {
  const pct = max <= 0 ? 0 : Math.min(100, Math.round((value / max) * 100));
  const fill = tone === "ok" ? "var(--app-success)" : tone === "warn" ? "var(--app-warning)" : "var(--o-gradient)";
  return (
    <span className="block h-2 overflow-hidden rounded-full bg-white/[0.08]" role="img" aria-label={`${label}: ${value} of ${max}`}>
      <span className="block h-full rounded-full" style={{ width: `${pct}%`, background: fill }} />
    </span>
  );
}

export interface StackPart {
  key: string;
  label: string;
  value: number;
  color: string;
  href?: string;
  active?: boolean;
}

/** One stacked bar plus a legend that doubles as filters. Colour is never the only cue: every legend row shows its count. */
export function StackBar({ parts, total }: { parts: StackPart[]; total: number }) {
  return (
    <div>
      <div className="flex h-3.5 overflow-hidden rounded-full bg-white/[0.08]" role="img" aria-label={parts.map((p) => `${p.label} ${p.value}`).join(", ")}>
        {parts.filter((p) => p.value > 0).map((p) => (
          <span key={p.key} style={{ width: `${(p.value / Math.max(1, total)) * 100}%`, background: p.color }} />
        ))}
      </div>
      <ul className="mt-3 flex flex-wrap gap-2">
        {parts.map((p) => {
          const body = (
            <>
              <span className="h-2.5 w-2.5 rounded-full" style={{ background: p.color }} aria-hidden="true" />
              <span className="font-bold text-app-charcoal">{p.value}</span>
              <span className="text-app-muted">{p.label}</span>
              {total > 0 && <span className="text-app-muted">· {Math.round((p.value / total) * 100)}%</span>}
            </>
          );
          const cls = clsx("flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12.5px]", p.active ? "border-app-orange bg-app-orange-container" : "border-app-border");
          return (
            <li key={p.key}>
              {p.href ? (
                <Link href={p.href} aria-current={p.active} className={clsx(cls, "hover:bg-white/[0.05]")}>
                  {body}
                </Link>
              ) : (
                <span className={cls}>{body}</span>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export function Pager({ page, pageCount, hrefFor }: { page: number; pageCount: number; hrefFor: (page: number) => string }) {
  if (pageCount <= 1) return null;
  const nums = [...new Set([1, page - 1, page, page + 1, pageCount])].filter((n) => n >= 1 && n <= pageCount).sort((a, b) => a - b);
  return (
    <nav aria-label="Pages" className="mt-4 flex items-center justify-center gap-1">
      <Link href={hrefFor(Math.max(1, page - 1))} aria-label="Previous page" aria-disabled={page === 1} className="o-btn-ghost !px-2.5">
        <ChevronLeft size={15} aria-hidden="true" />
      </Link>
      {nums.map((n, i) => (
        <span key={n} className="flex items-center gap-1">
          {i > 0 && n - nums[i - 1] > 1 && <span className="px-1 text-app-muted">…</span>}
          <Link href={hrefFor(n)} aria-current={n === page ? "page" : undefined} className={n === page ? "o-btn !px-3" : "o-btn-ghost !px-3"}>
            {n}
          </Link>
        </span>
      ))}
      <Link href={hrefFor(Math.min(pageCount, page + 1))} aria-label="Next page" aria-disabled={page === pageCount} className="o-btn-ghost !px-2.5">
        <ChevronRight size={15} aria-hidden="true" />
      </Link>
    </nav>
  );
}

/** Small rounded initial tile (company, student, subject). */
export function Initial({ text, size = 36 }: { text: string; size?: number }) {
  return (
    <span className="grid shrink-0 place-items-center rounded-xl bg-app-orange-container font-extrabold text-app-orange" style={{ width: size, height: size, fontSize: size * 0.4 }} aria-hidden="true">
      {text.trim().charAt(0).toUpperCase() || "•"}
    </span>
  );
}

/** A labelled value used in summary strips. */
export function Fact({ label, value, hint, href, tone = "text-app-charcoal" }: { label: string; value: ReactNode; hint?: string; href?: string; tone?: string }) {
  const body = (
    <>
      <p className="text-[12.5px] font-semibold text-app-muted">{label}</p>
      <p className={`mt-1 text-[28px] font-extrabold leading-none tracking-[-0.03em] ${tone}`}>{value}</p>
      {hint && <p className="mt-1.5 text-[12px] text-app-muted">{hint}</p>}
    </>
  );
  return href ? (
    <Link href={href} className="o-card block p-4">
      {body}
    </Link>
  ) : (
    <div className="o-card p-4">{body}</div>
  );
}

/** Heading + count for a group of records. */
export function GroupTitle({ children, count }: { children: ReactNode; count?: number }) {
  return (
    <h2 className="mb-2.5 flex items-baseline gap-2 text-[15px] font-bold text-app-charcoal">
      {children}
      {count !== undefined && <span className="text-[12.5px] font-semibold text-app-muted">{count}</span>}
    </h2>
  );
}

/** A short pipeline: done steps are filled, the first open step is the current one. */
export function StageTrack({ steps }: { steps: { label: string; done: boolean }[] }) {
  const current = steps.findIndex((s) => !s.done);
  return (
    <ol className="flex flex-wrap items-center gap-x-1.5 gap-y-1" aria-label="Progress">
      {steps.map((s, i) => (
        <li key={s.label} className="flex items-center gap-1.5">
          {i > 0 && <span aria-hidden="true" className={clsx("h-px w-4", s.done || i <= current ? "bg-[var(--m-accent-ink)]" : "bg-app-border")} />}
          <span
            className={clsx(
              "inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11.5px] font-bold",
              s.done ? "bg-app-success-container text-app-success" : i === current ? "bg-app-orange-container text-app-orange" : "text-app-muted"
            )}
            aria-current={i === current ? "step" : undefined}
          >
            <span aria-hidden="true">{s.done ? "✓" : i + 1}</span> {s.label}
          </span>
        </li>
      ))}
    </ol>
  );
}
