import type { OrgKind } from "./roles";

export interface OrgNavItem {
  label: string;
  href: string;
}

// Only pages the role can actually use (server routes re-check every action regardless).
export function orgNavFor(kind: OrgKind): OrgNavItem[] {
  switch (kind) {
    case "admin":
      return [
        { label: "Overview", href: "/org" },
        { label: "Members", href: "/org/members" },
        { label: "Materials", href: "/org/materials" },
        { label: "Projects", href: "/org/projects" },
        { label: "Placements", href: "/org/placements" },
        { label: "Insights", href: "/org/insights" },
        { label: "Posts & page", href: "/org/posts" },
        { label: "Curriculum", href: "/admin/curriculum" },
      ];
    case "staff":
      return [
        { label: "Overview", href: "/org" },
        { label: "Materials", href: "/org/materials" },
        { label: "Projects", href: "/org/projects" },
        { label: "Posts", href: "/org/posts" },
      ];
    case "tpo":
      return [
        { label: "Overview", href: "/org" },
        { label: "Placements", href: "/org/placements" },
        { label: "Insights", href: "/org/insights" },
      ];
    default:
      return [];
  }
}

export const ROLE_LABEL: Record<string, string> = {
  faculty: "Faculty",
  hod: "Head of Department",
  principal: "Principal",
  vice_principal: "Vice Principal",
  tpo: "Training & Placement Officer",
};
