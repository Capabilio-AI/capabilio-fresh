import Link from "next/link";

export interface SectionTab {
  label: string;
  href: string;
  /** hidden when the viewer lacks the permission behind this page */
  show: boolean;
}

/** Tabs that group sibling pages under one sidebar entry (Curriculum + Academic calendar, Team & access + Team chat). Hidden when only one tab is visible. */
export function SectionTabs({ tabs, active, label }: { tabs: SectionTab[]; active: string; label: string }) {
  const visible = tabs.filter((t) => t.show);
  if (visible.length < 2) return null;
  return (
    <nav aria-label={label} className="mb-6 flex flex-wrap gap-1.5">
      {visible.map((t) => {
        const on = t.href === active;
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={on ? "page" : undefined}
            className={`rounded-full px-3.5 py-1.5 font-lp-body text-[13px] font-semibold transition-colors ${on ? "bg-app-charcoal text-white" : "border border-app-border bg-white text-app-muted hover:text-app-charcoal"}`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}
