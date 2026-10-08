import Link from "next/link";
import clsx from "clsx";
import type { GlassTab } from "@/components/metro/GlassTabs";

/** Flat text tabs with an accent underline: a quieter, library-style switch. */
export function UnderlineTabs({ label, tabs }: { label: string; tabs: GlassTab[] }) {
  return (
    <nav aria-label={label} className="-mx-4 overflow-x-auto px-4 sm:mx-0 sm:px-0">
      <div className="flex min-w-max gap-6 border-b border-[var(--m-rule)]">
        {tabs.map((tab) => (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={tab.active ? "page" : undefined}
            className={clsx("relative -mb-px border-b-[3px] pb-2.5 pt-1.5 text-[14px] font-bold transition-colors", tab.active ? "border-[var(--m-accent)] text-[var(--m-ink)]" : "border-transparent text-[var(--m-muted)] hover:text-[var(--m-ink)]")}
          >
            {tab.label}
          </Link>
        ))}
      </div>
    </nav>
  );
}
