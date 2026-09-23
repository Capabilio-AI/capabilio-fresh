"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Lock } from "lucide-react";
import clsx from "clsx";
import { isNavItemActive, type NavItem } from "@/lib/nav/config";

export function NavLink({ item, locked, onNavigate }: { item: NavItem; locked?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const active = isNavItemActive(pathname, item.href);
  const Icon = item.icon;

  return (
    <Link
      href={item.href}
      onClick={onNavigate}
      aria-current={active ? "page" : undefined}
      className={clsx(
        "group flex items-center gap-3 rounded-lg px-3 py-2.5 font-lp-body text-[13.5px] font-medium transition-colors",
        active
          ? "bg-white/10 text-white"
          : "text-white/65 hover:bg-white/5 hover:text-white"
      )}
    >
      <Icon size={17} strokeWidth={2} className={clsx("shrink-0", active ? "text-app-orange" : "text-white/50 group-hover:text-white/80")} />
      <span className="flex-1 truncate">{item.label}</span>
      {locked && <Lock size={13} className="shrink-0 text-white/35" aria-label="Locked" />}
    </Link>
  );
}
