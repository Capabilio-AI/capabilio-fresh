"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LogOut, UserCircle } from "lucide-react";
import { signOut } from "@/components/login/auth";
import { initialsOf, type ViewerSummary } from "@/lib/dashboard/viewer";

/**
 * There was previously no sign-out affordance anywhere in the app — no
 * button, no handler, no supabase.auth.signOut() call (confirmed by
 * grepping the whole repo before writing this). This replaces the avatar's
 * former dead-end Link to /profile with a real menu.
 */
export function AccountMenu({ viewer }: { viewer: ViewerSummary }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    function onClickOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("mousedown", onClickOutside);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("mousedown", onClickOutside);
    };
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    // router.refresh() re-runs every server component on the current route
    // with the now-cleared session cookie before the login redirect lands —
    // without it, a cached client-side render could flash stale content.
    router.refresh();
    router.push("/login");
  }

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Account menu"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-app-charcoal font-lp-display text-[12px] font-semibold text-white"
      >
        {initialsOf(viewer.fullName, viewer.email)}
      </button>

      {open && (
        <div
          role="menu"
          className="absolute right-0 top-11 z-30 w-56 overflow-hidden rounded-xl border border-app-border bg-white shadow-lg"
        >
          <div className="border-b border-app-border px-3.5 py-3">
            <p className="truncate font-lp-body text-[13px] font-medium text-app-charcoal">
              {viewer.fullName ?? "Student"}
            </p>
            <p className="truncate font-lp-mono text-[11px] text-app-muted">{viewer.email}</p>
          </div>
          <Link
            href="/profile"
            role="menuitem"
            onClick={() => setOpen(false)}
            className="flex items-center gap-2.5 px-3.5 py-2.5 font-lp-body text-[13px] text-app-charcoal hover:bg-app-background"
          >
            <UserCircle size={16} className="text-app-muted" />
            Profile
          </Link>
          <button
            type="button"
            role="menuitem"
            onClick={handleSignOut}
            disabled={signingOut}
            className="flex w-full items-center gap-2.5 border-t border-app-border px-3.5 py-2.5 text-left font-lp-body text-[13px] font-medium text-app-charcoal hover:bg-app-background disabled:opacity-60"
          >
            <LogOut size={16} className="text-app-muted" />
            {signingOut ? "Signing out…" : "Sign out"}
          </button>
        </div>
      )}
    </div>
  );
}
