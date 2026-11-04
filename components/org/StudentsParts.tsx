import Link from "next/link";
import { Crown } from "lucide-react";
import type { RosterRow } from "@/lib/org/roster";
import { cellKey } from "@/lib/org/roster";
import type { CohortInsights, TopStudent } from "@/lib/org/roster-insights";
import { Pill } from "@/components/org/ui";
import { ActionButton } from "@/components/org/ActionButton";

/** The student's own profile picture, or their initial when they have none. */
export function Avatar({ name, url, size = 44 }: { name: string; url: string | null; size?: number }) {
  const box = { width: size, height: size, fontSize: size * 0.4 };
  return url ? (
    // eslint-disable-next-line @next/next/no-img-element -- storage-hosted profile picture, arbitrary origin
    <img src={url} alt="" width={size} height={size} loading="lazy" className="shrink-0 rounded-2xl object-cover" style={box} />
  ) : (
    <span className="grid shrink-0 place-items-center rounded-2xl bg-app-orange-container font-extrabold text-app-orange" style={box} aria-hidden="true">
      {name.trim().charAt(0).toUpperCase() || "•"}
    </span>
  );
}

const EloBadge = ({ elo }: { elo: RosterRow["elo"] }) =>
  elo ? (
    <span className="inline-flex items-baseline gap-1.5 rounded-full bg-[var(--m-accent-soft)] px-3 py-1 text-[var(--m-accent-ink)]" title={elo.career ? `ELO on ${elo.career}` : "ELO"}>
      <span className="text-[10.5px] font-extrabold">ELO</span>
      <span className="text-[15px] font-black leading-none tabular-nums">{elo.rating}</span>
      <span className="text-[11px] font-bold">{elo.tier}</span>
    </span>
  ) : (
    <Pill tone="neutral">Not rated yet</Pill>
  );

const Stat = ({ n, label }: { n: number; label: string }) => (
  <div>
    <dd className={`text-[18px] font-extrabold leading-none tabular-nums ${n ? "text-app-charcoal" : "text-app-muted/60"}`}>{n}</dd>
    <dt className="mt-1 text-[11.5px] text-app-muted">{label}</dt>
  </div>
);

export function StudentCard({ r, canRemove }: { r: RosterRow; canRemove: boolean }) {
  return (
    <li className="o-card flex flex-col gap-3.5 p-4">
      <div className="flex items-center gap-3">
        <Avatar name={r.name} url={r.avatarUrl} size={48} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14.5px] font-bold text-app-charcoal">{r.name}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-app-muted">
            <span>{r.rollNumber ?? "No roll number"}</span>
            {r.rollStatus === "flagged" && <Pill tone="warn">Not matched</Pill>}
          </p>
        </div>
      </div>
      <p className="truncate text-[12.5px] text-app-muted" title={r.branch ?? undefined}>
        {r.branch ?? "Branch not set"}
        {r.endYear ? ` · Class of ${r.endYear}` : ""}
      </p>
      <div className="flex items-center justify-between gap-2">
        <EloBadge elo={r.elo} />
        {canRemove && <ActionButton action="/api/org/students/remove" body={{ userId: r.userId }} label="Remove" variant="ghost" confirm={`Remove ${r.name} from your college? They stop being counted here. Their account and work stay with them.`} />}
      </div>
      <dl className="grid grid-cols-3 gap-2 border-t border-app-border pt-3">
        <Stat n={r.groups} label={r.groups === 1 ? "Group" : "Groups"} />
        <Stat n={r.gradedProjects} label="Graded" />
        <Stat n={r.arenaLast30} label="Arena · 30d" />
      </dl>
    </li>
  );
}

export function StudentRow({ r, canRemove }: { r: RosterRow; canRemove: boolean }) {
  return (
    <li className="grid grid-cols-[40px_minmax(0,1fr)] items-center gap-3 px-4 py-3 md:grid-cols-[40px_minmax(0,1.3fr)_minmax(0,1fr)_auto]">
      <Avatar name={r.name} url={r.avatarUrl} size={40} />
      <div className="min-w-0">
        <p className="truncate text-[14px] font-semibold text-app-charcoal">{r.name}</p>
        <p className="flex flex-wrap items-center gap-x-2 text-[12.5px] text-app-muted">
          <span>{r.rollNumber ?? "No roll number"}</span>
          {r.rollStatus === "flagged" && <Pill tone="warn">Not matched</Pill>}
        </p>
      </div>
      <p className="hidden min-w-0 truncate text-[12.5px] text-app-muted md:block">
        {r.branch ?? "Branch not set"}
        {r.endYear ? ` · Class of ${r.endYear}` : ""}
      </p>
      <p className="col-span-2 flex flex-wrap items-center gap-1.5 md:col-span-1 md:justify-end">
        <EloBadge elo={r.elo} />
        <Pill tone={r.gradedProjects ? "ok" : "neutral"}>{r.gradedProjects} graded</Pill>
        <Pill tone={r.arenaLast30 ? "ok" : "neutral"}>{r.arenaLast30} Arena · 30d</Pill>
        {canRemove && <ActionButton action="/api/org/students/remove" body={{ userId: r.userId }} label="Remove" variant="ghost" confirm={`Remove ${r.name} from your college? They stop being counted here. Their account and work stay with them.`} />}
      </p>
    </li>
  );
}

/** The whole cohort at a glance: how many students sit in each ELO tier, and how many have no rating yet. */
export function EloSpread({ insights }: { insights: CohortInsights }) {
  const { distribution, total, rated, capped } = insights;
  const shown = distribution.filter((s) => s.count > 0);
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <p className="text-[13px] font-bold text-app-charcoal">ELO spread</p>
        <p className="text-[12px] text-app-muted">{rated.toLocaleString("en-IN")} of {total.toLocaleString("en-IN")} rated{capped ? " (first 3,000)" : ""}</p>
      </div>
      <div className="mt-2.5 flex h-3 overflow-hidden rounded-full bg-app-border" role="img" aria-label={shown.map((s) => `${s.label}: ${s.count}`).join(", ")}>
        {shown.map((s) => (
          <span key={s.label} style={{ flexGrow: s.count, background: s.hatched ? `repeating-linear-gradient(135deg, ${s.color} 0 2px, transparent 2px 6px)` : s.color }} title={`${s.label}: ${s.count}`} />
        ))}
      </div>
      <ul className="mt-2.5 flex flex-wrap gap-x-4 gap-y-1 text-[12px] text-app-muted">
        {shown.map((s) => (
          <li key={s.label} className="inline-flex items-center gap-1.5">
            <i className="h-2 w-2 rounded-full" style={{ background: s.hatched ? `repeating-linear-gradient(135deg, ${s.color} 0 1.5px, transparent 1.5px 3px)` : s.color }} />
            {s.label} <b className="font-bold tabular-nums text-app-charcoal">{s.count.toLocaleString("en-IN")}</b>
          </li>
        ))}
      </ul>
    </div>
  );
}

export function TopPerformers({ top }: { top: TopStudent[] }) {
  if (top.length === 0) return null;
  return (
    <section aria-label="Top rated">
      <h2 className="mb-2.5 text-[15px] font-bold text-app-charcoal">Top rated</h2>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
        {top.map((t, i) => (
          <li key={t.userId} className="o-card flex items-center gap-3 p-3.5">
            <span className="relative">
              <Avatar name={t.name} url={t.avatarUrl} size={44} />
              {i === 0 && <Crown size={14} className="absolute -right-1.5 -top-2 rotate-12 text-[var(--m-accent-ink)]" aria-label="Highest rated" />}
            </span>
            <div className="min-w-0">
              <p className="truncate text-[13.5px] font-bold text-app-charcoal">{t.name}</p>
              <p className="text-[12px] tabular-nums text-app-muted"><b className="text-[15px] font-black text-[var(--m-accent-ink)]">{t.rating}</b> · {t.tier}</p>
            </div>
          </li>
        ))}
      </ol>
    </section>
  );
}

type Matrix = { branches: string[]; years: (number | null)[]; cells: Record<string, number>; branchTotals: Record<string, number> };
const SHADES = [1, 0.78, 0.58, 0.42, 0.3];

/** One card per branch; its bar is split by class year. Click a segment for that cohort, the title for the whole branch. */
export function CohortExplorer({ matrix, hrefFor, activeBranch, activeYear }: { matrix: Matrix; hrefFor: (next: { branch?: string; year?: string }) => string; activeBranch?: string; activeYear?: string }) {
  const branches = [...matrix.branches].sort((a, b) => matrix.branchTotals[b] - matrix.branchTotals[a]);
  const card = (b: string) => {
    const total = matrix.branchTotals[b];
    const years = matrix.years.filter((y) => (matrix.cells[cellKey(b, y)] ?? 0) > 0);
    return (
      <li key={b} className={`o-card p-4 ${activeBranch === b ? "ring-2 ring-[var(--m-ink)]" : ""}`}>
        <div className="flex items-baseline justify-between gap-3">
          <Link href={hrefFor({ branch: b })} className="min-w-0 truncate text-[13.5px] font-bold text-app-charcoal hover:underline" title={b}>{b}</Link>
          <span className="text-[20px] font-extrabold tabular-nums leading-none text-app-charcoal">{total.toLocaleString("en-IN")}</span>
        </div>
        <div className="mt-3 flex h-2.5 gap-0.5 overflow-hidden rounded-full">
          {years.map((y, i) => (
            <Link key={String(y)} href={hrefFor({ branch: b, year: y ? String(y) : "none" })} title={`Class of ${y ?? "not set"}: ${matrix.cells[cellKey(b, y)]}`} aria-label={`${b}, class of ${y ?? "not set"}: ${matrix.cells[cellKey(b, y)]} students`} style={{ flexGrow: matrix.cells[cellKey(b, y)], background: `rgba(224, 163, 12, ${SHADES[Math.min(i, SHADES.length - 1)]})` }} />
          ))}
        </div>
        <ul className="mt-2.5 flex flex-wrap gap-1.5">
          {years.map((y) => {
            const on = activeBranch === b && activeYear === (y === null ? "none" : String(y));
            return (
              <li key={String(y)}>
                <Link href={hrefFor({ branch: b, year: y ? String(y) : "none" })} aria-current={on} className={`rounded-full border px-2.5 py-0.5 text-[12px] font-semibold tabular-nums transition-colors hover:bg-[var(--m-accent-soft)] ${on ? "border-[var(--m-ink)] bg-[var(--m-accent-soft)] text-app-charcoal" : "border-app-border text-app-muted"}`}>
                  {y ?? "No class"} · {matrix.cells[cellKey(b, y)]}
                </Link>
              </li>
            );
          })}
        </ul>
      </li>
    );
  };
  const FIRST = 6;
  return (
    <>
      <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{branches.slice(0, FIRST).map(card)}</ul>
      {branches.length > FIRST && (
        <details className="group mt-3">
          <summary className="cursor-pointer text-[13px] font-semibold text-app-orange hover:underline group-open:hidden">Show all {branches.length} branches</summary>
          <ul className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{branches.slice(FIRST).map(card)}</ul>
        </details>
      )}
    </>
  );
}
