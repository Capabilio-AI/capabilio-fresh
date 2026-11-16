"use client";

import { usePathname } from "next/navigation";
import { GlassTabs } from "@/components/metro/GlassTabs";

const TABS = [
  { label: "Openings", href: "/professional/jobs" },
  { label: "Application tracker", href: "/professional/jobs/tracker" },
  { label: "Feedback", href: "/professional/jobs/feedback" },
];

export function JobsTabs() {
  const pathname = usePathname();
  return <GlassTabs label="Jobs" sticky={false} tabs={TABS.map((t) => ({ ...t, active: pathname === t.href }))} />;
}
