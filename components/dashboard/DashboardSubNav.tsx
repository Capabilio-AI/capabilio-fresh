"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useDirectionFlags } from "@/components/direction/DirectionContext";

const TABS: { label: string; href: string; jobTrackOnly?: boolean; launchpadOnly?: boolean }[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Portfolio", href: "/dashboard/portfolio" },
  { label: "Skills & Gaps", href: "/dashboard/skills" },
  { label: "Roadmap", href: "/dashboard/roadmap" },
  { label: "Vault History", href: "/dashboard/vault" },
  { label: "AI Interview", href: "/dashboard/interview", launchpadOnly: true },
];

/** The dashboard's tabs as a frosted-glass segmented control; the current tab is the raised white thumb. */
export function DashboardSubNav() {
  const pathname = usePathname();
  const { isJobTrack, launchpadOpen } = useDirectionFlags();
  const tabs = TABS.filter((t) => (!t.jobTrackOnly || isJobTrack) && (!t.launchpadOnly || launchpadOpen));
  return (
    <nav aria-label="Dashboard" className="sticky top-[118px] z-10 -mx-1 overflow-x-auto px-1 py-1">
      <div className="glass inline-flex min-w-max gap-0.5 rounded-full p-1">
        {tabs.map((tab) => {
          const active = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
          return (
            <Link
              key={tab.href}
              href={tab.href}
              aria-current={active ? "page" : undefined}
              className={clsx(
                "rounded-full px-3.5 py-1.5 text-[13.5px] font-bold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none",
                active ? "glass-thumb text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:bg-white/55 hover:text-[var(--m-ink)]"
              )}
            >
              {tab.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
