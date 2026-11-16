import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import "@/components/metro/metro.css";
import { metroFontVars } from "@/components/metro/font";
import { AdminNav } from "./AdminNav";
import { AdminFrame } from "./AdminFrame";
import { SignOutButton } from "./SignOutButton";
import { ROLE_LABEL, type AdminLimits } from "@/lib/admin/permissions";

/** The admin console's own frame, separate from the student, graduate and professional apps: dark rail, warm canvas, one search that finds any person. */
export function AdminShell({ email, pending, limits, children }: { email: string | null; pending: number; limits: AdminLimits; children: ReactNode }) {
  const sidebar = (
    <aside className="bg-[var(--m-ink)] px-4 pb-3 pt-4 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-5 lg:py-6">
      <Link href="/admin" className="flex shrink-0 items-center gap-2.5 px-3 pb-3 lg:pb-6">
        <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--m-accent)] font-lp-display text-[16px] font-bold">C</span>
        <span className="font-lp-display text-[17px] font-bold tracking-tight">Capabilio <span className="text-[var(--m-accent)]">Console</span></span>
      </Link>
      {/* the menu scrolls on a short screen, so the sign-out below it is always reachable */}
      <div className="lg:min-h-0 lg:flex-1 lg:overflow-y-auto lg:pr-1"><AdminNav pending={pending} limits={limits} /></div>
      <div className="hidden shrink-0 border-t border-white/10 pt-3 lg:block">
        <p className="truncate px-3 font-lp-body text-[12px] text-white/50">{email ?? "Admin"} · {ROLE_LABEL[limits.role]}</p>
        <SignOutButton label="Sign out" icon className="mt-1 flex w-full items-center gap-2 rounded-xl px-3 py-2 text-left font-lp-body text-[13px] font-semibold text-white/80 hover:bg-white/10 hover:text-white" />
        <Link href="/" className="flex items-center gap-1.5 rounded-xl px-3 py-2 font-lp-body text-[13px] font-semibold text-white/55 hover:bg-white/5 hover:text-white">Capabilio website <ArrowUpRight size={14} aria-hidden /></Link>
      </div>
    </aside>
  );
  const header = (
    <>
      <form action="/admin/people" className="relative min-w-0 flex-1 sm:max-w-md" role="search">
        <Search size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--m-muted)]" />
        <input name="q" placeholder="Find anyone by name or email" aria-label="Search people" className="field-ring w-full rounded-full border border-[var(--m-rule)] bg-white py-2.5 pl-10 pr-4 font-lp-body text-[14px] text-[var(--m-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]" />
      </form>
      <SignOutButton label="Sign out" icon className="ml-auto flex shrink-0 items-center gap-1.5 rounded-full border border-[var(--m-rule)] bg-white px-3.5 py-2 font-lp-body text-[13px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)]" />
    </>
  );
  return (
    <div className={`metro ${metroFontVars}`} data-area="admin">
      <AdminFrame sidebar={sidebar} header={header}>{children}</AdminFrame>
    </div>
  );
}
