import Link from "next/link";

export interface SectionTab {
  label: string;
  href: string;
  /** hidden when the viewer lacks the permission behind this page */
  show: boolean;
}

/**
 * Tabs that group sibling pages under one sidebar entry (Curriculum + Academic calendar, Team & access + Team chat). Hidden when only one tab is visible.
 * Same frosted pill and raised thumb as the workspace navigation (`ws-pill` / `ws-thumb`). In the workspace `text-white` and `bg-white` are
 * the ink colour, so the white thumb is the explicit `ws-thumb` class and the colours are `--m-*` tokens.
 */
export function SectionTabs({ tabs, active, label }: { tabs: SectionTab[]; active: string; label: string }) {
  const visible = tabs.filter((t) => t.show);
  if (visible.length < 2) return null;
  return (
    <nav aria-label={label} className="mb-6 overflow-x-auto">
      <div className="ws-pill inline-flex min-w-max items-center gap-0.5 rounded-full p-1">
        {visible.map((t) => {
          const on = t.href === active;
          return (
            <Link
              key={t.href}
              href={t.href}
              aria-current={on ? "page" : undefined}
              className={`whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] font-bold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none ${on ? "ws-thumb text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:bg-[#fff]/60 hover:text-[var(--m-ink)]"}`}
            >
              {t.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
