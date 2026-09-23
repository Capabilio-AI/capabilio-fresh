import {
  LayoutDashboard,
  GraduationCap,
  Swords,
  Activity,
  Rocket,
  MessagesSquare,
  Sparkles,
  Bell,
  Settings,
  UserCircle,
  type LucideIcon,
} from "lucide-react";
import { UNLOCK_STAGE_KEY } from "@/lib/journey/stage";

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  /** When set, the item renders locked until the student reaches this journey stage. */
  lockedUntilStage?: string;
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
    lockedUntilStage: UNLOCK_STAGE_KEY,
    lockedMessage: "Complete your 3-2 career development stage to unlock jobs and internships.",
  },
  {
    label: "AI Interview",
    href: "/interview",
    icon: MessagesSquare,
    lockedUntilStage: UNLOCK_STAGE_KEY,
    lockedMessage: "Complete your 3-2 development stage to unlock AI-powered interview preparation.",
  },
  { label: "AI Mentor", href: "/mentor", icon: Sparkles },
];

export const UTILITY_NAV: NavItem[] = [
  { label: "Notifications", href: "/notifications", icon: Bell },
  { label: "Settings", href: "/settings", icon: Settings },
  { label: "Profile", href: "/profile", icon: UserCircle },
];

export function isNavItemActive(pathname: string, href: string): boolean {
  if (href === "/dashboard") return pathname === "/dashboard" || pathname.startsWith("/dashboard/");
  return pathname === href || pathname.startsWith(`${href}/`);
}
