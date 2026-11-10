"use client";

import { usePathname } from "next/navigation";
import { UnderlineTabs } from "@/components/metro/UnderlineTabs";

const TABS = [
  { label: "Courses", href: "/skillstudio" },
  { label: "Materials", href: "/skillstudio/materials" },
  { label: "Languages", href: "/skillstudio/languages" },
  { label: "Certifications", href: "/skillstudio/certifications" },
  { label: "CRT", href: "/skillstudio/crt" },
];

export function SkillStudioSubNav() {
  const pathname = usePathname();
  return <UnderlineTabs label="SkillStudio" tabs={TABS.map((t) => ({ ...t, active: t.href === "/skillstudio" ? pathname === "/skillstudio" || pathname.startsWith("/skillstudio/course") : t.href === "/skillstudio/languages" ? pathname.startsWith(t.href) : pathname === t.href }))} />;
}
