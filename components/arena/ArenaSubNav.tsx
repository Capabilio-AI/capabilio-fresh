"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { label: "Overview", href: "/arena" },
  { label: "Challenges", href: "/arena/challenges" },
  { label: "Projects", href: "/arena/projects" },
  { label: "Competitions", href: "/arena/competitions" },
];

export function ArenaSubNav() {
  const pathname = usePathname();
  return (
    <div className="-mx-4 overflow-x-auto border-b border-app-border px-4 sm:mx-0 sm:px-0">
      <div className="flex gap-1 whitespace-nowrap">
        {TABS.map((tab) => {
          const active = tab.href === "/arena" ? pathname === "/arena" : pathname === tab.href;
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative px-3.5 py-3 font-lp-body text-[13.5px] font-medium transition-colors",
                active ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal"
              )}
            >
              {tab.label}
              {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-app-orange" />}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
