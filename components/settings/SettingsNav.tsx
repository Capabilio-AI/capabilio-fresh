"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Database, ShieldCheck, User } from "lucide-react";
import clsx from "clsx";

const GROUPS = [
  { label: "Account", items: [{ href: "/settings", label: "Account", icon: User }] },
  {
    label: "Security & privacy",
    items: [
      { href: "/settings/security", label: "Security", icon: ShieldCheck },
      { href: "/settings/privacy", label: "Privacy & data", icon: Database },
    ],
  },
] as const;

/** Side rail on wide screens, a scrolling row on narrow ones. Every item is a real link, so each page is addressable. */
export function SettingsNav() {
  const pathname = usePathname();
  const isActive = (href: string) => (href === "/settings" ? pathname === "/settings" || pathname.startsWith("/settings/direction") : pathname.startsWith(href));

  return (
    <nav aria-label="Settings" className="-mx-1 overflow-x-auto px-1 lg:sticky lg:top-[118px] lg:mx-0 lg:w-56 lg:shrink-0 lg:self-start lg:overflow-visible lg:px-0">
      <div className="flex min-w-max gap-1 lg:min-w-0 lg:flex-col lg:gap-6">
        {GROUPS.map((group) => (
          <div key={group.label} className="flex gap-1 lg:flex-col">
            <p className="hidden px-3 pb-1 font-lp-body text-[12px] font-bold text-[var(--m-off)] lg:block">{group.label}</p>
            {group.items.map(({ href, label, icon: Icon }) => {
              const active = isActive(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={clsx(
                    "flex items-center gap-2.5 rounded-lg px-3 py-2 font-lp-body text-[13.5px] font-bold transition-colors motion-reduce:transition-none",
                    active ? "bg-[var(--m-sheet)] text-[var(--m-ink)] shadow-[0_1px_2px_rgb(20_20_20/0.08),0_0_0_1px_var(--m-rule)]" : "text-[var(--m-muted)] hover:bg-[var(--m-sheet)]/60 hover:text-[var(--m-ink)]"
                  )}
                >
                  <Icon size={16} aria-hidden className={active ? "text-[var(--m-accent-ink)]" : undefined} />
                  {label}
                </Link>
              );
            })}
          </div>
        ))}
      </div>
    </nav>
  );
}
