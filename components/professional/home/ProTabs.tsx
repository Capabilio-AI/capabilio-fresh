"use client";

import { usePathname } from "next/navigation";
import { GlassTabs } from "@/components/metro/GlassTabs";

const TABS = [
  { label: "Overview", href: "/professional" },
  { label: "Portfolio", href: "/professional/portfolio" },
  { label: "Skill graph", href: "/professional/skills" },
  { label: "Vault", href: "/professional/vault" },
  { label: "Profile", href: "/professional/profile" },
];

/** The pages under a professional's Dashboard, in the same frosted-glass control the other paths use. */
export function ProTabs() {
  const pathname = usePathname();
  return <GlassTabs label="Professional dashboard" sticky={false} tabs={TABS.map((t) => ({ ...t, active: pathname === t.href }))} />;
}
