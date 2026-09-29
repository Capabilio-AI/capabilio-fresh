"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, LogOut } from "lucide-react";
import clsx from "clsx";
import { signOut } from "@/components/login/auth";
import type { OrgNavGroup } from "@/lib/org/nav";

function isActive(pathname: string, href: string): boolean {
  return href === "/org" ? pathname === "/org" : pathname === href || pathname.startsWith(`${href}/`);
}

export function OrgShell({
  institutionName,
  roleLabel,
  groups,
  children,
}: {
  institutionName: string;
  roleLabel: string;
  groups: OrgNavGroup[];
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  return (
    <div className="min-h-screen bg-app-background">
      <header className="sticky top-0 z-20 border-b border-app-border bg-white/95 backdrop-blur">
        <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/org" className="flex shrink-0 items-center gap-2.5">
            <Image src="/logo-mark.jpg" alt="" width={26} height={26} className="h-[26px] w-[26px] rounded object-cover" />
            <span className="hidden font-lp-display text-[15px] font-semibold tracking-tight text-app-charcoal sm:inline">
              Capabilio <span className="text-app-orange">AI</span>
            </span>
          </Link>
          <div className="min-w-0 flex-1">
            <p className="flex items-center gap-1.5 truncate font-lp-body text-[13.5px] font-medium text-app-charcoal">
              {institutionName}
              <BadgeCheck size={14} className="shrink-0 text-app-blue" aria-label="Approved by the Capabilio team" />
            </p>
            <p className="truncate font-lp-mono text-[11px] text-app-muted">{roleLabel}</p>
          </div>
          <button
            type="button"
            onClick={async () => {
              await signOut();
              router.push("/login?path=organisation");
            }}
            className="inline-flex items-center gap-1.5 rounded-lg border border-app-border px-3 py-1.5 font-lp-body text-[12.5px] text-app-charcoal hover:bg-black/5"
          >
            <LogOut size={14} />
            Sign out
          </button>
        </div>
      </header>

      <div className="mx-auto flex max-w-[1400px] flex-col gap-4 px-4 py-6 sm:px-6 md:flex-row md:gap-8 lg:px-8">
        <nav aria-label="Organisation" className="shrink-0 md:w-52">
          <div className="flex gap-4 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible">
            {groups.map((group) => (
              <div key={group.label} className="shrink-0">
                <p className="mb-1 hidden px-3 font-lp-mono text-[10.5px] font-semibold uppercase tracking-wider text-app-muted md:block">{group.label}</p>
                <ul className="flex gap-1 md:flex-col">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={clsx(
                            "block whitespace-nowrap rounded-lg px-3 py-2 font-lp-body text-[13.5px] font-medium transition-colors",
                            active ? "bg-white text-app-charcoal shadow-sm ring-1 ring-app-border" : "text-app-muted hover:bg-black/5 hover:text-app-charcoal"
                          )}
                        >
                          {item.label}
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ))}
          </div>
        </nav>
        <main className="min-w-0 flex-1">{children}</main>
      </div>
    </div>
  );
}
