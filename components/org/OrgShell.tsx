"use client";

import { Fragment, type ReactNode } from "react";
import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, BookOpen, Briefcase, Eye, FolderKanban, GraduationCap, LayoutDashboard, Megaphone, MessagesSquare, School, Settings, Target, Trophy, UserCheck, Users, type LucideIcon } from "lucide-react";
import clsx from "clsx";
import "@/components/metro/metro.css";
import type { OrgNavGroup } from "@/lib/org/nav";
import { OrgAccountMenu } from "./OrgAccountMenu";

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

export const initialsOf = (name: string) =>
  name
    .split(/\s+/)
    .filter((w) => /^[A-Za-z]/.test(w))
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join("") || "•";

/** Round glass button that slides its label out on hover or focus (the student app's settings-button style). */
function Dock({ href, label, external, children }: { href: string; label: string; external?: boolean; children: ReactNode }) {
  return (
    <Link
      href={href}
      aria-label={label}
      {...(external ? { target: "_blank", rel: "noopener noreferrer" } : {})}
      className="group relative flex h-9 shrink-0 items-center rounded-full px-[9px] text-[var(--m-ink)] transition-[background-color,box-shadow,padding] duration-300 ease-out hover:bg-[#fff] hover:pr-4 hover:shadow-[0_4px_14px_-6px_rgba(60,40,0,0.4)] focus-visible:bg-[#fff] focus-visible:pr-4 motion-reduce:transition-none"
    >
      <span className="flex h-[20px] w-[20px] items-center justify-center">{children}</span>
      <span aria-hidden className="max-w-0 overflow-hidden whitespace-nowrap text-[13px] font-bold opacity-0 transition-[max-width,opacity,margin] duration-300 ease-out group-hover:ml-2 group-hover:max-w-[8rem] group-hover:opacity-100 group-focus-visible:ml-2 group-focus-visible:max-w-[8rem] group-focus-visible:opacity-100 motion-reduce:transition-none">
        {label}
      </span>
    </Link>
  );
}

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
  const hasTeam = groups.some((g) => g.items.some((i) => i.href === "/org/team"));
  const hasCollege = groups.some((g) => g.items.some((i) => i.href === "/org/college"));

  return (
    <div className="min-h-screen">
      <header className="ws-topbar sticky top-0 z-30">
        <div className="mx-auto flex h-[64px] max-w-[1400px] items-center gap-3 px-4 sm:px-6 lg:px-8">
          <Link href="/org" aria-label="Capabilio AI, workspace home" className="flex shrink-0 items-center">
            <Image src="/brand/capabilio-logo.png" alt="Capabilio AI" width={1130} height={234} priority className="h-[36px] w-auto sm:h-[42px]" />
          </Link>

          <div className="ws-pill hidden min-w-0 items-center gap-2.5 rounded-full py-1 pl-1 pr-4 md:flex" title={institutionName}>
            <span className="o-logo-tile h-8 w-8 shrink-0 rounded-full text-[12px]" aria-hidden="true">
              {initialsOf(institutionName)}
            </span>
            <span className="min-w-0">
              <span className="block max-w-[26rem] truncate text-[13.5px] font-extrabold leading-tight text-[var(--m-ink)]">{institutionName}</span>
              <span className="block truncate text-[11.5px] leading-tight text-[var(--m-muted)]">{roleLabel}</span>
            </span>
          </div>

          <div className="min-w-0 flex-1" />

          <div className="ws-pill flex shrink-0 items-center gap-0.5 rounded-full p-1">
            <Dock href={publicHref} label="Public page" external>
              <Eye size={18} strokeWidth={2.2} />
            </Dock>
            {hasCollege && (
              <Dock href="/org/college" label="College page">
                <School size={18} strokeWidth={2.2} />
              </Dock>
            )}
            {hasTeam && (
              <Dock href="/org/team" label="Settings">
                <Settings size={18} strokeWidth={2.2} />
              </Dock>
            )}
            <span aria-hidden className="mx-1 h-6 w-px bg-[var(--m-rule)]" />
            <OrgAccountMenu institutionName={institutionName} roleLabel={roleLabel} publicHref={publicHref} initials={initialsOf(institutionName)} />
          </div>
        </div>
      </header>

      <nav aria-label="Organisation" className="sticky top-[64px] z-20 bg-[var(--m-ground)] px-4 pb-2">
        <div className="mx-auto flex max-w-full justify-start overflow-x-auto py-0.5 lg:justify-center">
          <div className="ws-pill inline-flex min-w-max items-center gap-0.5 rounded-full p-1">
            {groups.map((group, gi) => (
              <Fragment key={group.label}>
                {gi > 0 && <span aria-hidden className="mx-1 h-5 w-px bg-[var(--m-soft)]" />}
                {group.items.map((item) => {
                  const active = isActive(pathname, item.href);
                  const Icon = ICONS[item.href] ?? LayoutDashboard;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      aria-current={active ? "page" : undefined}
                      className={clsx(
                        "flex shrink-0 items-center gap-2 whitespace-nowrap rounded-full px-3.5 py-1.5 text-[14px] font-bold transition-[background-color,color,box-shadow,transform] duration-200 ease-out active:scale-[0.97] motion-reduce:transition-none",
                        active ? "ws-thumb text-[var(--m-ink)]" : "text-[var(--m-muted)] hover:bg-[#fff]/60 hover:text-[var(--m-ink)]"
                      )}
                    >
                      <Icon size={16} strokeWidth={2.2} className={active ? "text-[var(--m-accent)]" : ""} aria-hidden="true" />
                      {item.label}
                    </Link>
                  );
                })}
              </Fragment>
            ))}
          </div>
        </div>
      </nav>

      <main className="mx-auto max-w-[1400px] px-4 py-6 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-[1120px]">{children}</div>
      </main>
    </div>
  );
}
