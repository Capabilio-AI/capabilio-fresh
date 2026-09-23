"use client";

import Link from "next/link";
import { Bell, Menu, Search } from "lucide-react";
import { initialsOf, type ViewerSummary } from "@/lib/dashboard/viewer";

function firstName(fullName: string | null, email: string): string {
  if (fullName) return fullName.trim().split(/\s+/)[0];
  return email.split("@")[0];
}

export function Topbar({ viewer, onMenuClick }: { viewer: ViewerSummary; onMenuClick: () => void }) {
  return (
    <header className="sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-app-border bg-app-background/95 px-4 backdrop-blur sm:px-6">
      <button
        type="button"
        onClick={onMenuClick}
        aria-label="Open menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-app-charcoal hover:bg-black/5 lg:hidden"
      >
        <Menu size={20} />
      </button>

      <div className="min-w-0 flex-1">
        <p className="hidden truncate font-lp-body text-[15px] font-semibold text-app-charcoal sm:block">
          Welcome back, {firstName(viewer.fullName, viewer.email)}
        </p>
      </div>

      <label className="relative hidden w-full max-w-xs items-center md:flex">
        <Search size={15} className="pointer-events-none absolute left-3 text-app-muted" />
        <span className="sr-only">Search</span>
        <input
          type="search"
          placeholder="Search skills, careers, challenges…"
          className="w-full rounded-full border border-app-border bg-white py-2 pl-9 pr-3 font-lp-body text-[13px] text-app-charcoal placeholder:text-app-muted focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20"
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
        href="/profile"
        aria-label="Your profile"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-charcoal font-lp-display text-[12px] font-semibold text-white"
      >
        {initialsOf(viewer.fullName, viewer.email)}
      </Link>
    </header>
  );
}
