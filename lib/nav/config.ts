import {
  LayoutDashboard,
  GraduationCap,
  Swords,
  Activity,
  Rocket,
  MessagesSquare,
  Sparkles,
  type LucideIcon,
} from "lucide-react";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** Locked until the student is in the career-direction window (lib/career/trigger.ts). */
  requiresDirectionWindow?: boolean;
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
    requiresDirectionWindow: true,
    lockedMessage: "Available in your final two years, once your career direction window opens.",
  },
  {
    label: "AI Interview",
    href: "/interview",
    icon: MessagesSquare,
    requiresDirectionWindow: true,
    lockedMessage: "Available in your final two years, once your career direction window opens.",
  },
  { label: "AI Mentor", href: "/mentor", icon: Sparkles },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
