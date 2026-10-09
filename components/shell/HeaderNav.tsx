"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { PRIMARY_NAV, isNavItemActive } from "@/lib/nav/config";

/** The app's pages as a centred frosted-glass bar; the current page is the raised white thumb. */
export function HeaderNav({ launchpadOpen }: { launchpadOpen: boolean }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Primary" className="sticky top-[64px] z-20 bg-[var(--m-ground)] px-4 pb-2 pt-0">
      <div className="mx-auto flex max-w-full justify-center overflow-x-auto py-0.5">
        <div className="glass inline-flex min-w-max gap-0.5 rounded-full p-1">
          {PRIMARY_NAV.filter((item) => !item.requiresLaunchpad || launchpadOpen).map((item) => {
            const active = isNavItemActive(pathname, item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-4 py-1.5 text-[14px] font-bold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none sm:px-5 sm:text-[15px]",
                  active ? "glass-thumb text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:bg-white/60 hover:text-[var(--m-ink)]"
                )}
              >
                <Icon size={16} strokeWidth={2.2} className={active ? "text-[var(--m-accent)]" : ""} aria-hidden />
                {item.label}
              </Link>
            );
          })}
        </div>
      </div>
    </nav>
  );
}
