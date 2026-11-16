"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { Activity, Building2, Briefcase, ClipboardCheck, Crown, GraduationCap, History, KeyRound, LayoutGrid, ShieldCheck, UserCog, Users, UserRoundCheck } from "lucide-react";
import { can, type AdminLimits, type Permission } from "@/lib/admin/permissions";

const ITEMS = [
  { href: "/admin", label: "Overview", icon: LayoutGrid, exact: true, needs: ["view"] },
  { href: "/admin/approvals", label: "Approvals", icon: ClipboardCheck, badge: true, needs: ["lists"] },
  { href: "/admin/colleges", label: "Colleges", icon: GraduationCap, needs: ["lists"] },
  { href: "/admin/people", label: "People", icon: Users, needs: ["lists", "lookup"] },
  { href: "/admin/professionals", label: "Professionals", icon: UserRoundCheck, needs: ["lists"] },
  { href: "/admin/companies", label: "Companies", icon: Briefcase, needs: ["lists"] },
  { href: "/admin/executives", label: "Executives", icon: Crown, needs: ["lists"] },
  { href: "/admin/activity", label: "Activity", icon: Activity, needs: ["view"] },
  { href: "/admin/decisions", label: "Decision log", icon: History, needs: ["lists"] },
] as const;

const TOOLS = [
  { href: "/admin/pulse", label: "Pulse moderation", icon: ShieldCheck, needs: ["lists"] },
  { href: "/admin/careers", label: "Careers hiring", icon: Building2, needs: ["lists"] },
] as const;

const ACCESS = [
  { href: "/admin/team", label: "Team", icon: UserCog, needs: ["team"] },
  { href: "/admin/account", label: "Account", icon: KeyRound, needs: [] },
] as const;

/** The console's navigation: a dark rail on large screens, a scrolling strip on small ones. The open section is marked with the brand orange. */
export function AdminNav({ pending, limits }: { pending: number; limits: AdminLimits }) {
  const path = usePathname();
  const on = (href: string, exact?: boolean) => (exact ? path === href : path === href || path.startsWith(`${href}/`));
  const allowed = (needs: readonly Permission[]) => needs.length === 0 || needs.some((p) => can(limits, p));
  const link = (i: { href: string; label: string; icon: typeof LayoutGrid; exact?: boolean; badge?: boolean; needs: readonly Permission[] }) => {
    const Icon = i.icon;
    const active = on(i.href, i.exact);
    return (
      <Link key={i.href} href={i.href} aria-current={active ? "page" : undefined}
        className={clsx("group relative flex shrink-0 items-center gap-3 rounded-xl px-3 py-2.5 font-lp-body text-[14px] font-semibold transition-colors", active ? "bg-white/10 text-white" : "text-white/65 hover:bg-white/5 hover:text-white")}>
        {active && <span aria-hidden className="absolute -left-3 top-2 hidden h-6 w-1 rounded-full bg-[var(--m-accent)] lg:block" />}
        <Icon size={17} aria-hidden className={active ? "text-[var(--m-accent)]" : ""} />
        <span className="whitespace-nowrap">{i.label}</span>
        {i.badge && pending > 0 && <span className="ml-auto grid h-5 min-w-5 place-items-center rounded-full bg-[var(--m-accent)] px-1.5 text-[11px] font-bold text-white">{pending > 99 ? "99+" : pending}</span>}
      </Link>
    );
  };
  return (
    <nav aria-label="Admin" className="flex gap-1 overflow-x-auto lg:flex-col lg:overflow-visible">
      {ITEMS.filter((i) => allowed(i.needs)).map(link)}
      {TOOLS.some((t) => allowed(t.needs)) && <p className="mt-4 hidden px-3 pb-1 font-lp-body text-[11px] font-bold uppercase tracking-[0.14em] text-white/40 lg:block">Tools</p>}
      {TOOLS.filter((t) => allowed(t.needs)).map(link)}
      <p className="mt-4 hidden px-3 pb-1 font-lp-body text-[11px] font-bold uppercase tracking-[0.14em] text-white/40 lg:block">You</p>
      {ACCESS.filter((t) => allowed(t.needs)).map(link)}
    </nav>
  );
}
