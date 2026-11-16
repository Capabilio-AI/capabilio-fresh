import {
  LayoutDashboard,
  GraduationCap,
  Swords,
  Activity,
  Rocket,
  Briefcase,
  HeartHandshake,
  Compass,
  type LucideIcon,
} from "lucide-react";
import type { CareerStage } from "@/lib/stage/stage";
import { unlocksFor } from "@/lib/student/phase";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Locked until the student reaches their final year (lib/career/term.ts#isLaunchpadOpen). */
  requiresLaunchpad?: boolean;
  lockedMessage?: string;
}

export const PRIMARY_NAV: NavItem[] = [
  { label: "Dashboard", href: "/dashboard", icon: LayoutDashboard },
  { label: "SkillStudio", href: "/skillstudio", icon: GraduationCap },
  { label: "Arena", href: "/arena", icon: Swords },
  { label: "Pulse", href: "/pulse", icon: Activity },
  {
    label: "Launchpad",
    href: "/launchpad",
    icon: Rocket,
    requiresLaunchpad: true,
    lockedMessage: "Opens when you enter your final year (4-1).",
  },
];

const EXPLORE_ITEM: NavItem = { label: "Explore roles", href: "/explore", icon: Compass };

/** A working professional has their own pages: no SkillStudio, Arena or Launchpad. */
const PROFESSIONAL_NAV: NavItem[] = [
  { label: "Dashboard", href: "/professional", icon: LayoutDashboard },
  { label: "Jobs", href: "/professional/jobs", icon: Briefcase },
  { label: "Mentor", href: "/professional/mentor", icon: HeartHandshake },
  { label: "Pulse", href: "/professional/pulse", icon: Activity },
];

/** Which pages each stage sees. A graduate's Launchpad is always open (they are job-hunting now); professionals have their own pages (PROFESSIONAL_NAV). */
export function navFor(stage: CareerStage, launchpadOpen: boolean, student: { year: number | null; hasRole: boolean } = { year: null, hasRole: true }): NavItem[] {
  if (stage === "professional") return PROFESSIONAL_NAV;
  if (stage === "graduate") return PRIMARY_NAV.map((i) => ({ ...i, requiresLaunchpad: false }));
  const open = unlocksFor(student.year, student.hasRole);
  const items = PRIMARY_NAV.filter((i) => (!i.requiresLaunchpad || launchpadOpen) && (i.href !== "/arena" || open.arena));
  // A student who has not chosen a role gets Explore, right after the dashboard, until they do.
  return open.explore ? [items[0], EXPLORE_ITEM, ...items.slice(1)] : items;
}

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  if (href === "/professional") return pathname === href || pathname.startsWith("/professional/portfolio") || pathname.startsWith("/professional/profile") || pathname.startsWith("/professional/skills") || pathname.startsWith("/professional/vault");
  return pathname === href || pathname.startsWith(`${href}/`);
}
