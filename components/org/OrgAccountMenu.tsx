"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BadgeCheck, ChevronDown, ExternalLink, LogOut } from "lucide-react";
import { signOut } from "@/components/login/auth";

/** The institution's account menu: gold-ringed avatar, an espresso card with the college name, and sign out. */
export function OrgAccountMenu({ institutionName, roleLabel, publicHref, initials }: { institutionName: string; roleLabel: string; publicHref: string; initials: string }) {
  const [open, setOpen] = useState(false);
  const [signingOut, setSigningOut] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  const router = useRouter();

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onClick = (e: MouseEvent) => ref.current && !ref.current.contains(e.target as Node) && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.addEventListener("mousedown", onClick);
    return () => {
      document.removeEventListener("keydown", onKey);
      document.removeEventListener("mousedown", onClick);
    };
  }, [open]);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.refresh();
    router.push("/login?path=organisation");
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Account menu for ${institutionName}`}
        className="group flex h-9 items-center gap-2 rounded-full py-0.5 pl-0.5 pr-2.5 transition-[background-color,box-shadow] duration-200 hover:bg-[#fff] hover:shadow-[0_4px_14px_-6px_rgba(60,40,0,0.4)] motion-reduce:transition-none"
      >
        <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full p-[2px]" style={{ background: "conic-gradient(from 210deg, #d38f05, #f6d17a 55%, #d38f05)" }}>
          <span className="flex h-full w-full items-center justify-center rounded-full bg-[#1e1707] text-[11px] font-extrabold text-[#fff] ring-2 ring-[#fff]">{initials}</span>
        </span>
        <ChevronDown size={15} aria-hidden className={`text-[var(--m-muted)] transition-transform duration-200 motion-reduce:transition-none ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div role="menu" className="ws-pill absolute right-0 top-[2.9rem] z-40 w-[300px] overflow-hidden rounded-3xl !bg-[#fff]/90 p-2">
          <div className="relative overflow-hidden rounded-2xl bg-[#1e1707] p-4 text-[#fff]">
            <span aria-hidden className="pointer-events-none absolute -right-8 -top-8 h-28 w-28 rounded-full border-[14px] border-[#e0a30c]/60" />
            <span aria-hidden className="pointer-events-none absolute -bottom-3 right-6 h-3 w-3 rounded-full bg-[#e0a30c]" />
            <span className="relative flex h-14 w-14 items-center justify-center rounded-full bg-[#fff] text-[18px] font-extrabold text-[#1e1707]">{initials}</span>
            <p className="relative mt-3 text-[18px] font-extrabold leading-tight">{institutionName}</p>
            <p className="relative text-[13px] text-[#fff]/70">{roleLabel}</p>
            <p className="relative mt-2 flex items-center gap-1.5 text-[12px] font-semibold text-[#7be0b4]">
              <BadgeCheck size={14} aria-hidden /> Approved by Capabilio
            </p>
          </div>
          <div className="mt-2 flex flex-col gap-0.5">
            <Link href={publicHref} target="_blank" rel="noopener noreferrer" role="menuitem" onClick={() => setOpen(false)} className="group flex items-center gap-3 rounded-2xl px-3 py-2.5 transition-colors hover:bg-[#fff]">
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--m-accent-soft)] text-[var(--m-ink)] transition-colors group-hover:bg-[#1e1707] group-hover:text-[#fff]">
                <ExternalLink size={17} aria-hidden />
              </span>
              <span>
                <span className="block text-[14.5px] font-bold text-[var(--m-ink)]">Preview public page</span>
                <span className="block text-[12.5px] text-[var(--m-muted)]">What students and visitors see</span>
              </span>
            </Link>
            <button type="button" role="menuitem" onClick={handleSignOut} disabled={signingOut} className="mt-1 flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors hover:bg-[var(--m-accent-soft)] disabled:opacity-60">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]">
                <LogOut size={17} aria-hidden />
              </span>
              <span className="text-[14.5px] font-bold text-[var(--m-ink)]">{signingOut ? "Signing out…" : "Sign out"}</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
