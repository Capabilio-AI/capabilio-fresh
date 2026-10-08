"use client";

import { usePathname } from "next/navigation";
import { GlassTabs } from "@/components/metro/GlassTabs";

const TABS = [
  { label: "Overview", href: "/arena" },
  { label: "Challenges", href: "/arena/challenges" },
  { label: "Projects", href: "/arena/projects" },
  { label: "Competitions", href: "/arena/competitions" },
];

export function ArenaSubNav() {
  const pathname = usePathname();
  return <GlassTabs label="Arena" tone="dark" sticky={false} tabs={TABS.map((t) => ({ ...t, active: t.href === "/arena" ? pathname === "/arena" : pathname === t.href || pathname.startsWith(`${t.href}/`) }))} />;
}
