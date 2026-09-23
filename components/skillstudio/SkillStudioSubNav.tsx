"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";

const TABS = [
  { label: "My Path", href: "/skillstudio" },
  { label: "Foundations", href: "/skillstudio/foundations" },
  { label: "Courses", href: "/skillstudio/courses" },
  { label: "Certifications", href: "/skillstudio/certifications" },
];

export function SkillStudioSubNav() {
  const pathname = usePathname();
  return (
    <div className="-mx-4 overflow-x-auto border-b border-app-border px-4 sm:mx-0 sm:px-0">
      <div className="flex gap-1 whitespace-nowrap">
        {TABS.map((tab) => {
          const active = tab.href === "/skillstudio" ? pathname === "/skillstudio" : pathname === tab.href;
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
