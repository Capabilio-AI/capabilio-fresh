import Image from "next/image";
import Link from "next/link";
import { Bell, Search, Settings } from "lucide-react";
import type { ViewerSummary } from "@/lib/dashboard/viewer";
import { AccountMenu } from "@/components/shell/AccountMenu";

function firstName(fullName: string | null, email: string): string {
  if (fullName) return fullName.trim().split(/\s+/)[0];
  return email.split("@")[0];
}

export function Topbar({ viewer }: { viewer: ViewerSummary }) {
  return (
    <header className="sticky top-0 z-20 bg-white/95 backdrop-blur">
      <div className="mx-auto flex h-16 max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
        <Link href="/dashboard" className="flex shrink-0 items-center gap-2.5">
          <Image
            src="/logo-mark.jpg"
            alt=""
            width={26}
            height={26}
            className="h-[26px] w-[26px] rounded object-cover"
          />
          <span className="hidden font-lp-display text-[15px] font-semibold tracking-tight text-app-charcoal sm:inline">
            Capabilio <span className="text-app-orange">AI</span>
          </span>
        </Link>

        <div className="min-w-0 flex-1">
          <p className="hidden truncate font-lp-body text-[14px] font-medium text-app-charcoal md:block">
            Welcome back, {firstName(viewer.fullName, viewer.email)}
          </p>
        </div>

        <label className="relative hidden w-full max-w-xs items-center md:flex">
          <Search size={15} className="pointer-events-none absolute left-3 text-app-muted" />
          <span className="sr-only">Search</span>
          <input
            type="search"
            placeholder="Search skills, careers, challenges…"
            className="w-full rounded-full border border-app-border bg-app-background py-2 pl-9 pr-3 font-lp-body text-[13px] text-app-charcoal placeholder:text-app-muted focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20"
          />
        </label>

        <Link
          href="/notifications"
          aria-label="Notifications"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-app-charcoal hover:bg-black/5"
        >
          <Bell size={18} />
        </Link>
        <Link
          href="/settings"
          aria-label="Settings"
          className="hidden h-9 w-9 shrink-0 items-center justify-center rounded-full text-app-charcoal hover:bg-black/5 sm:flex"
        >
          <Settings size={18} />
        </Link>
        <AccountMenu viewer={viewer} />
      </div>
    </header>
  );
}
