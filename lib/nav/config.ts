import {
  LayoutDashboard,
  GraduationCap,
  Swords,
  Activity,
  Rocket,
  type LucideIcon,
} from "lucide-react";

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

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
