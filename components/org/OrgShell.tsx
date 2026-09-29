"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { BadgeCheck, BarChart3, BookOpen, Briefcase, ExternalLink, FolderKanban, GraduationCap, LayoutDashboard, LogOut, Megaphone, Trophy, UserCheck, Users, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import { signOut } from "@/components/login/auth";
import type { OrgNavGroup } from "@/lib/org/nav";

const ICONS: Record<string, LucideIcon> = {
  "/org": LayoutDashboard,
  "/org/posts": Megaphone,
  "/org/students": Users,
  "/org/materials": BookOpen,
  "/org/projects": FolderKanban,
  "/org/placements": Briefcase,
  "/org/members": UserCheck,
  "/admin/curriculum": GraduationCap,
  "/org/insights": BarChart3,
  "/org/outcomes": Trophy,
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
      <aside className="border-b border-app-border md:sticky md:top-0 md:h-screen md:w-[246px] md:shrink-0 md:overflow-y-auto md:border-b-0 md:border-r">
        <div className="flex items-center gap-2.5 px-5 py-5">
          <Image src="/logo-mark.jpg" alt="" width={28} height={28} className="h-7 w-7 rounded-lg object-cover" />
          <span className="text-[15px] font-extrabold tracking-tight text-app-charcoal">
            Capabilio <span className="text-app-orange">AI</span>
          </span>
        </div>

        <div className="mx-4 mb-4 rounded-2xl border border-app-border bg-white/[0.03] p-3">
          <div className="flex items-center gap-2.5">
            <span className="o-logo-tile h-10 w-10 shrink-0 rounded-xl text-[14px]">{initialsOf(institutionName)}</span>
            <div className="min-w-0">
              <p className="line-clamp-2 text-[12.5px] font-bold leading-tight text-app-charcoal">{institutionName}</p>
              <p className="mt-0.5 truncate text-[11px] text-app-muted">{roleLabel}</p>
            </div>
          </div>
          <p className="mt-2.5 flex items-center gap-1.5 text-[11px] font-semibold text-app-success">
            <BadgeCheck size={13} aria-hidden="true" /> Approved by Capabilio
          </p>
        </div>

        <nav aria-label="Organisation" className="px-3 pb-4">
          <div className="flex gap-4 overflow-x-auto md:flex-col md:gap-5 md:overflow-visible">
            {groups.map((group) => (
              <div key={group.label} className="shrink-0">
                <p className="o-eyebrow mb-1.5 hidden px-3 md:block">{group.label}</p>
                <ul className="flex gap-1 md:flex-col">
                  {group.items.map((item) => {
                    const active = isActive(pathname, item.href);
                    const Icon = ICONS[item.href] ?? LayoutDashboard;
                    return (
                      <li key={item.href}>
                        <Link
                          href={item.href}
                          aria-current={active ? "page" : undefined}
                          className={clsx(
                            "flex items-center gap-2.5 whitespace-nowrap rounded-xl px-3 py-2.5 text-[13px] font-semibold transition-colors",
                            active ? "text-[#23170a] shadow-[0_6px_20px_rgba(220,139,24,0.22)]" : "text-app-muted hover:bg-white/5 hover:text-app-charcoal"
                          )}
                          style={active ? { background: "var(--o-gradient)" } : undefined}
                        >
                          <Icon size={16} strokeWidth={2.2} aria-hidden="true" />
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

        <div className="mt-auto hidden border-t border-app-border p-3 md:block">
          <Link href={publicHref} className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold text-app-muted hover:bg-white/5 hover:text-app-charcoal">
            <ExternalLink size={15} aria-hidden="true" /> View college page
          </Link>
          <button type="button" onClick={doSignOut} className="flex w-full items-center gap-2 rounded-xl px-3 py-2.5 text-[12.5px] font-semibold text-app-muted hover:bg-white/5 hover:text-app-charcoal">
            <LogOut size={15} aria-hidden="true" /> Sign out
          </button>
        </div>
      </aside>

      <div className="min-w-0 flex-1">
        <div className="mx-auto max-w-[1120px] px-4 py-8 sm:px-8 md:py-10">{children}</div>
      </div>
    </div>
  );
}
