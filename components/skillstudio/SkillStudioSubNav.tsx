"use client";

import { usePathname } from "next/navigation";
import { UnderlineTabs } from "@/components/metro/UnderlineTabs";

const TABS = [
  { label: "My Path", href: "/skillstudio" },
  { label: "Foundations", href: "/skillstudio/foundations" },
  { label: "Courses", href: "/skillstudio/courses" },
  { label: "Materials", href: "/skillstudio/materials" },
  { label: "Certifications", href: "/skillstudio/certifications" },
];

export function SkillStudioSubNav() {
  const pathname = usePathname();
  return <UnderlineTabs label="SkillStudio" tabs={TABS.map((t) => ({ ...t, active: t.href === "/skillstudio" ? pathname === "/skillstudio" : pathname === t.href }))} />;
}
