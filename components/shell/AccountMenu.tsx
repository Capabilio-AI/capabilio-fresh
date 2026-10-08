"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ChevronDown, LogOut, Settings, UserCircle } from "lucide-react";
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

  const first = (viewer.fullName ? viewer.fullName.trim().split(/\s+/)[0] : viewer.email.split("@")[0]) || "You";
  const initials = initialsOf(viewer.fullName, viewer.email);
  const avatar = viewer.avatarUrl ? (
    // eslint-disable-next-line @next/next/no-img-element -- storage-hosted user avatar, arbitrary origin
    <img src={viewer.avatarUrl} alt="" className="h-full w-full object-cover" />
  ) : (
    initials
  );

  return (
    <div ref={containerRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${first}`}
        className="group flex h-9 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2.5 transition-[background-color,box-shadow] duration-200 hover:bg-white hover:shadow-[0_4px_14px_-6px_rgba(20,20,20,0.35)] motion-reduce:transition-none"
      >
        {/* the ring is the brand arc: a conic orange sweep around the photo */}
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-[2px]" style={{ background: "conic-gradient(from 210deg, #ff5701, #ffb48a 55%, #ff5701)" }}>
          <span className="flex h-full w-full items-center justify-center overflow-hidden rounded-full bg-[#141414] font-lp-display text-[11px] font-bold text-white ring-2 ring-white">{avatar}</span>
        </span>
        <span className="hidden max-w-[6rem] truncate text-[13px] font-bold text-[var(--m-ink)] lg:block">{first}</span>
        <ChevronDown size={15} aria-hidden className={`hidden text-[var(--m-muted)] transition-transform duration-200 motion-reduce:transition-none lg:block ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="glass absolute right-0 top-[2.9rem] z-40 w-[300px] overflow-hidden rounded-3xl !bg-white/90 p-2 shadow-[0_28px_60px_-20px_rgba(20,20,20,0.5)]">
          <div className="relative overflow-hidden rounded-2xl bg-[#141414] p-4 text-white">
            <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border-[14px] border-[#ff5701]/60" />
            <span aria-hidden className="pointer-events-none absolute -bottom-3 right-6 h-3 w-3 rounded-full bg-[#ff5701]" />
            <span className="relative flex h-14 w-14 items-center justify-center overflow-hidden rounded-full bg-white font-lp-display text-[18px] font-bold text-[#141414]">{avatar}</span>
            <p className="relative mt-3 truncate font-lp-display text-[20px] font-bold leading-tight">{viewer.fullName ?? "Student"}</p>
            <p className="relative truncate text-[13px] text-white/70">{viewer.email}</p>
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            <MenuLink href="/profile" icon={UserCircle} label="Your profile" hint="Education, branch and career goal" onDone={() => setOpen(false)} />
            <MenuLink href="/settings" icon={Settings} label="Settings" hint="Account, direction and privacy" onDone={() => setOpen(false)} />
            <button type="button" role="menuitem" onClick={handleSignOut} disabled={signingOut} className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[#fff0e8] disabled:opacity-60">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[#fff0e8] text-[#c2410c]"><LogOut size={17} aria-hidden /></span>
              <span className="text-[14.5px] font-bold text-[#141414]">{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function MenuLink({ href, icon: Icon, label, hint, onDone }: { href: string; icon: typeof Settings; label: string; hint: string; onDone: () => void }) {
  return (
    <Link href={href} role="menuitem" onClick={onDone} className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-white">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[#f5f6f1] text-[#141414] transition-colors group-hover:bg-[#141414] group-hover:text-white"><Icon size={17} aria-hidden /></span>
      <span className="min-w-0">
        <span className="block text-[14.5px] font-bold text-[#141414]">{label}</span>
        <span className="block truncate text-[12.5px] text-[#5c5c55]">{hint}</span>
      </span>
    </Link>
  );
}
