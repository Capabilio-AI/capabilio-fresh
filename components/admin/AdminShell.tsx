import Link from "next/link";
import type { ReactNode } from "react";
import { ArrowUpRight, Search } from "lucide-react";
import "@/components/metro/metro.css";
import { metroFontVars } from "@/components/metro/font";
import { AdminNav } from "./AdminNav";
import { ROLE_LABEL, type AdminLimits } from "@/lib/admin/permissions";

/** The admin console's own frame, separate from the student, graduate and professional apps: dark rail, warm canvas, one search that finds any person. */
export function AdminShell({ email, pending, limits, children }: { email: string | null; pending: number; limits: AdminLimits; children: ReactNode }) {
  return (
    <div className={`metro ${metroFontVars} min-h-screen bg-[var(--m-ground)] lg:grid lg:grid-cols-[256px_minmax(0,1fr)]`} data-area="admin">
      <aside className="bg-[var(--m-ink)] px-4 pb-3 pt-4 text-white lg:sticky lg:top-0 lg:flex lg:h-screen lg:flex-col lg:px-5 lg:py-6">
        <Link href="/admin" className="flex items-center gap-2.5 px-3 pb-3 lg:pb-6">
          <span aria-hidden className="grid h-8 w-8 place-items-center rounded-xl bg-[var(--m-accent)] font-lp-display text-[16px] font-bold">C</span>
          <span className="font-lp-display text-[17px] font-bold tracking-tight">Capabilio <span className="text-[var(--m-accent)]">Console</span></span>
        </Link>
        <AdminNav pending={pending} limits={limits} />
        <div className="mt-auto hidden pt-6 lg:block">
          <p className="truncate px-3 font-lp-body text-[12px] text-white/50">{email ?? "Admin"} · {ROLE_LABEL[limits.role]}</p>
          <Link href="/dashboard" className="mt-1 flex items-center gap-1.5 rounded-xl px-3 py-2 font-lp-body text-[13px] font-semibold text-white/65 hover:bg-white/5 hover:text-white">Back to the app <ArrowUpRight size={14} aria-hidden /></Link>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex items-center gap-3 border-b border-[var(--m-rule)] bg-[var(--m-ground)]/90 px-4 py-3 backdrop-blur sm:px-8">
          <form action="/admin/people" className="relative min-w-0 flex-1 sm:max-w-md" role="search">
            <Search size={16} aria-hidden className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-[var(--m-muted)]" />
            <input name="q" placeholder="Find anyone by name or email" aria-label="Search people" className="field-ring w-full rounded-full border border-[var(--m-rule)] bg-white py-2.5 pl-10 pr-4 font-lp-body text-[14px] text-[var(--m-ink)] outline-none focus-visible:ring-2 focus-visible:ring-[var(--m-accent)]" />
          </form>
          <Link href="/dashboard" className="ml-auto shrink-0 font-lp-body text-[13px] font-semibold text-[var(--m-muted)] hover:text-[var(--m-ink)] lg:hidden">App</Link>
        </header>
        <main className="mx-auto max-w-[1180px] px-4 py-8 sm:px-8">{children}</main>
      </div>
    </div>
  );
}
