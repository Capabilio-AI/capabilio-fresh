import type { ReactNode } from "react";
import clsx from "clsx";

/**
 * The head of an area that is not the dashboard. `dark` is a full band with rings (Arena, a lobby); `tint` is a soft accent panel (SkillStudio, a library).
 * `aside` holds the area's own numbers; `nav` is that area's tab bar.
 */
export function AreaHero({ tone, title, intro, aside, nav }: { tone: "dark" | "tint"; title: string; intro: string; aside?: ReactNode; nav: ReactNode }) {
  const dark = tone === "dark";
  return (
    <header className={clsx("relative overflow-hidden rounded-3xl p-5 sm:p-7 print:hidden", dark ? "bg-[var(--m-ink)] text-white" : "bg-[var(--m-accent-soft)] text-[var(--m-ink)]")}>
      {dark && (
        <>
          <span aria-hidden className="pointer-events-none absolute -right-24 -top-24 h-[22rem] w-[22rem] rounded-full border-[36px] border-white/[0.06]" />
          <span aria-hidden className="pointer-events-none absolute -right-2 -top-2 h-[12rem] w-[12rem] rounded-full border-[22px] border-[var(--m-accent)]/40" />
        </>
      )}
      <div className="relative flex flex-wrap items-end justify-between gap-6">
        <div className="min-w-0">
          <h1 className="font-lp-display text-[32px] font-bold leading-[1.05] tracking-tight sm:text-[46px]">{title}</h1>
          <p className={clsx("mt-2 max-w-[52ch] font-lp-body text-[15px] leading-relaxed", dark ? "text-white/75" : "text-[var(--m-muted)]")}>{intro}</p>
        </div>
        {aside && <div className="flex flex-wrap gap-3">{aside}</div>}
      </div>
      <div className="relative mt-5">{nav}</div>
    </header>
  );
}

/** One number in a hero: large value, small label. */
export function HeroStat({ value, label, tone }: { value: string | number; label: string; tone: "dark" | "tint" }) {
  return (
    <div className={clsx("min-w-[104px] rounded-2xl px-4 py-2.5", tone === "dark" ? "glass-dark" : "bg-white")}>
      <p className="font-lp-display text-[26px] font-bold leading-none">{value}</p>
      <p className={clsx("mt-0.5 text-[12.5px] font-bold", tone === "dark" ? "text-white/70" : "text-[var(--m-muted)]")}>{label}</p>
    </div>
  );
}
