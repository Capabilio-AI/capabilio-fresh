"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { LogOut } from "lucide-react";
import clsx from "clsx";
import { signOut } from "@/components/login/auth";
import type { OrgNavItem } from "@/lib/org/nav";

function isActive(pathname: string, href: string): boolean {
  return href === "/org" ? pathname === "/org" : pathname === href || pathname.startsWith(`${href}/`);
}

export function OrgShell({
  institutionName,
  roleLabel,
  nav,
  children,
}: {
  institutionName: string;
  roleLabel: string;
  nav: OrgNavItem[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  return (
    <div className="min-h-screen bg-app-background">
      <header className="sticky top-0 z-20 bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/org" className="flex shrink-0 items-center gap-2.5">
            <Image src="/logo-mark.jpg" alt="" width={26} height={26} className="h-[26px] w-[26px] rounded object-cover" />
            <span className="hidden font-lp-display text-[15px] font-semibold tracking-tight text-app-charcoal sm:inline">
              Capabilio <span className="text-app-orange">AI</span>
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="truncate font-lp-body text-[13.5px] font-medium text-app-charcoal">{institutionName}</p>
            <p className="truncate font-lp-mono text-[11px] text-app-muted">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              window.location.href = "/login?path=organisation";
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-app-border px-3 py-1.5 font-lp-body text-[12.5px] text-app-charcoal hover:bg-black/5"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>
      <nav aria-label="Organisation" className="border-b border-app-border bg-white">
        <div className="mx-auto flex max-w-[1400px] gap-1 overflow-x-auto px-4 sm:px-6 lg:px-8">
          {nav.map((item) => {
            const active = isActive(pathname, item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? "page" : undefined}
                className={clsx(
                  "relative shrink-0 whitespace-nowrap px-3.5 py-3 font-lp-body text-[13.5px] font-medium transition-colors",
                  active ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal"
                )}
              >
                {item.label}
                {active && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-app-orange" />}
              </Link>
            );
          })}
        </div>
      </nav>
      <main className="mx-auto max-w-[1100px] px-4 py-6 sm:px-6 lg:px-8">{children}</main>
    </div>
  );
}
