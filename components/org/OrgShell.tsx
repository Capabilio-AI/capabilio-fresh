"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, BarChart3, BookOpen, Briefcase, ExternalLink, FolderKanban, GraduationCap, LayoutDashboard, LogOut, Megaphone, MessagesSquare, School, Target, Trophy, UserCheck, Users, type LucideIcon } from "lucide-react";
import { signOut } from "@/components/login/auth";
import type { OrgNavGroup } from "@/lib/org/nav";

const ICONS: Record<string, LucideIcon> = {
  "/org": LayoutDashboard,
  "/org/college": School,
  "/org/posts": Megaphone,
  "/org/students": Users,
  "/org/materials": BookOpen,
  "/org/projects": FolderKanban,
  "/org/placements": Briefcase,
  "/org/members": UserCheck,
  "/org/team": UserCheck,
  "/org/curriculum": GraduationCap,
  "/org/career": Target,
  "/org/insights": BarChart3,
  "/org/outcomes": Trophy,
  "/org/chat": MessagesSquare,
};

function isActive(pathname: string, href: string): boolean {
  return href === "/org" ? pathname === "/org" : pathname === href || pathname.startsWith(`${href}/`);
}

const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "•";

export function OrgShell({
  institutionName,
  roleLabel,
  groups,
  publicHref,
  children,
}: {
  institutionName: string;
  roleLabel: string;
  groups: OrgNavGroup[];
  publicHref: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const router = useRouter();
  const doSignOut = async () => {
    await signOut();
    router.push("/login?path=organisation");
  };

  return (
    <div className="md:flex">
      <aside className="ws-rail md:sticky md:top-0 md:flex md:h-screen md:w-[256px] md:shrink-0 md:flex-col md:overflow-y-auto">
        <div className="flex items-center justify-between gap-3 px-4 pb-3 pt-4 md:px-5 md:pb-4 md:pt-5">
          <span className="rounded-lg bg-white px-2.5 py-1.5">
            <Image src="/brand/capabilio-logo.png" alt="Capabilio AI" width={1130} height={234} priority className="h-[22px] w-auto" />
          </span>
          <span className="o-logo-tile h-9 w-9 shrink-0 rounded-lg text-[13px] md:hidden" aria-hidden="true">
            {initialsOf(institutionName)}
          </span>
        </div>

        <div className="mx-4 mb-4 hidden rounded-xl bg-white/10 p-3 md:block">
          <div className="flex items-center gap-3">
            <span className="o-logo-tile h-10 w-10 shrink-0 rounded-lg text-[14px]">{initialsOf(institutionName)}</span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[13px] font-bold leading-tight text-white">{institutionName}</p>
              <p className="mt-0.5 truncate text-[12px] text-white/65">{roleLabel}</p>
            </div>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[12px] font-semibold text-[#7be0b4]">
            <BadgeCheck size={14} aria-hidden="true" /> Approved by Capabilio
          </p>
        </div>

        <nav aria-label="Organisation" className="px-3 pb-4 md:flex-1">
          <div className="flex gap-4 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible">
            {groups.map((group) => (
              <div key={group.label} className="shrink-0">
                <p className="ws-rail-label mb-1 hidden px-3 md:block">{group.label}</p>
                <ul className="flex gap-1 md:flex-col md:gap-0.5">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = ICONS[item.href] ?? LayoutDashboard;
                    return (
                      <li key={item.href}>
                        <Link href={item.href} aria-current={active ? "page" : undefined} className="ws-rail-link">
                          <Icon size={16} strokeWidth={2.1} aria-hidden="true" />
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

        <div className="hidden border-t border-white/15 p-3 md:block">
          <Link href={publicHref} target="_blank" rel="noopener noreferrer" className="ws-rail-link">
            <ExternalLink size={15} aria-hidden="true" /> Preview public page
          </Link>
          <button type="button" onClick={doSignOut} className="ws-rail-link w-full">
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1120px] px-4 py-7 sm:px-8 md:py-10">
          <div className="ws-page">{children}</div>
        </div>
      </div>
    </div>
  );
}
