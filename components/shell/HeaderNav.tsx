"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import clsx from "clsx";
import { PRIMARY_NAV, isNavItemActive } from "@/lib/nav/config";

export function HeaderNav({ launchpadOpen }: { launchpadOpen: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="border-b border-app-border bg-white">
      <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
        {PRIMARY_NAV.map((item) => {
          const active = isNavItemActive(pathname, item.href);
          const locked = item.requiresLaunchpad ? !launchpadOpen : false;
          const Icon = item.icon;
          return (
            <Link
              key={item.href}
              href={item.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "relative flex shrink-0 items-center gap-2 whitespace-nowrap px-3.5 py-3 font-lp-body text-[13.5px] font-medium transition-colors",
                active ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal"
              )}
            >
              <Icon size={15} strokeWidth={2} className={active ? "text-app-orange" : "text-app-muted"} />
              {item.label}
              {locked && <Lock size={11} className="text-app-muted" aria-label="Locked" />}
              {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-app-orange" />}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
