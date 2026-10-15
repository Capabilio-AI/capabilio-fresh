"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { useDirectionFlags } from "@/components/direction/DirectionContext";
import type { CareerStage } from "@/lib/stage/stage";

const TABS: { label: string; href: string; jobTrackOnly?: boolean; launchpadOnly?: boolean; stages: CareerStage[] }[] = [
  { label: "Overview", href: "/dashboard", stages: ["student", "graduate", "professional"] },
  { label: "Portfolio", href: "/dashboard/portfolio", stages: ["student", "graduate", "professional"] },
  { label: "Skills", href: "/dashboard/skills", stages: ["student", "graduate"] },
  // The roadmap is a student's plan through their programme; graduates and professionals do not have one.
  { label: "Roadmap", href: "/dashboard/roadmap", stages: ["student"] },
  { label: "Vault History", href: "/dashboard/vault", stages: ["student", "graduate", "professional"] },
  { label: "AI Interview", href: "/dashboard/interview", launchpadOnly: true, stages: ["student", "graduate", "professional"] },
];

/** The dashboard's tabs as a frosted-glass segmented control; the current tab is the raised white thumb. */
export function DashboardSubNav() {
  const pathname = usePathname();
  const { isJobTrack, launchpadOpen, stage } = useDirectionFlags();
  // Interview practice is for anyone out of study years: final-year students, graduates and professionals.
  const interviewOpen = launchpadOpen || stage !== "student";
  const tabs = TABS.filter((t) => t.stages.includes(stage) && (!t.jobTrackOnly || isJobTrack) && (!t.launchpadOnly || interviewOpen));
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
