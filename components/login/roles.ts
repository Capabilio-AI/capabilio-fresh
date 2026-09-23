import {
  Briefcase,
  Building2,
  Compass,
  GraduationCap,
  Landmark,
  LucideIcon,
  User,
  Users,
} from "lucide-react";
import type { Enums } from "@/lib/supabase/types";

export type RoleId = Enums<"app_role">;

export interface RoleConfig {
  id: RoleId;
  label: string;
  portal: string;
  icon: LucideIcon;
}

export const ROLES: RoleConfig[] = [
  { id: "student", label: "Student", portal: "Student Portal", icon: GraduationCap },
  { id: "faculty", label: "Faculty", portal: "Faculty Portal", icon: Users },
  { id: "hod", label: "HOD", portal: "HOD Portal", icon: Building2 },
  { id: "principal", label: "Principal", portal: "Institution Dashboard", icon: Landmark },
  {
    id: "vice_principal",
    label: "Vice Principal",
    portal: "Institution Dashboard",
    icon: Landmark,
  },
  { id: "ceo", label: "CEO", portal: "Executive Dashboard", icon: Briefcase },
  { id: "mentor", label: "Mentor", portal: "Mentor Workspace", icon: Compass },
  { id: "professional", label: "Professional", portal: "Professional Profile", icon: User },
];

export function getRole(id: RoleId): RoleConfig {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}
