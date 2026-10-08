import Link from "next/link";
import clsx from "clsx";

export interface GlassTab {
  label: string;
  href: string;
  active: boolean;
}

/** A frosted-glass segmented control made of real links; the current tab is the raised white thumb. `dark` sits on a dark band. */
export function GlassTabs({ label, tabs, sticky = true, tone = "light" }: { label: string; tabs: GlassTab[]; sticky?: boolean; tone?: "light" | "dark" }) {
  const dark = tone === "dark";
  return (
    <nav aria-label={label} className={clsx("-mx-1 overflow-x-auto px-1 py-1", sticky && "sticky top-[118px] z-10")}>
      <div className={clsx("inline-flex min-w-max gap-0.5 rounded-full p-1", dark ? "glass-dark" : "glass")}>
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={clsx(
              "rounded-full px-3.5 py-1.5 text-[13.5px] font-bold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none",
              tab.active ? "glass-thumb text-[var(--m-ink)]" : dark ? "text-white/75 hover:bg-white/12 hover:text-white" : "text-[var(--m-muted)] hover:bg-white/55 hover:text-[var(--m-ink)]"
            )}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
