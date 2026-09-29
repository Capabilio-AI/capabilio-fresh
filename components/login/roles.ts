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

// `tpo` and `company_admin` were added to app_role in migration 036; lib/supabase/types.ts predates it,
// so they are unioned here until the generated types are refreshed.
export type RoleId = Enums<"app_role"> | "tpo" | "company_admin";

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
  { id: "tpo", label: "TPO", portal: "Organisation Workspace", icon: Landmark },
  { id: "company_admin", label: "Company admin", portal: "Company Account", icon: Building2 },
];

export function getRole(id: RoleId): RoleConfig {
  return ROLES.find((r) => r.id === id) ?? ROLES[0];
}
