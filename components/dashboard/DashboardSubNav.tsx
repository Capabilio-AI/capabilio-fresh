"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useDirectionFlags } from "@/components/direction/DirectionContext";

const TABS: { label: string; href: string; jobTrackOnly?: boolean }[] = [
  { label: "Overview", href: "/dashboard" },
  { label: "Portfolio", href: "/dashboard/portfolio" },
  { label: "Skills & Gaps", href: "/dashboard/skills" },
  { label: "Roadmap", href: "/dashboard/roadmap" },
  { label: "Vault History", href: "/dashboard/vault" },
  { label: "AI Interview", href: "/dashboard/interview" },
];

export function DashboardSubNav() {
  const pathname = usePathname();
  const { isJobTrack } = useDirectionFlags();
  const tabs = TABS.filter((t) => !t.jobTrackOnly || isJobTrack);
  return (
    <div className="-mx-4 overflow-x-auto border-b border-app-border px-4 sm:mx-0 sm:px-0">
      <div className="flex gap-1 whitespace-nowrap">
        {tabs.map((tab) => {
          const active = tab.href === "/dashboard" ? pathname === "/dashboard" : pathname === tab.href || pathname.startsWith(`${tab.href}/`);
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
