import type { OrgKind } from "./roles";

export interface OrgNavItem {
  label: string;
  href: string;
}

export interface OrgNavGroup {
  label: string;
  items: OrgNavItem[];
}

const HOME: OrgNavItem = { label: "Home", href: "/org" };
const POSTS = (label: string): OrgNavItem => ({ label, href: "/org/posts" });

// Grouped like the reference Institution OS (Visibility / Operations / Intelligence) and filtered by role:
// only pages the role can use (server routes re-check every action regardless).
export function orgNavGroupsFor(kind: OrgKind): OrgNavGroup[] {
  switch (kind) {
    case "admin":
      return [
        { label: "Visibility", items: [HOME, POSTS("Posts & page")] },
        {
          label: "Operations",
          items: [
            { label: "Students", href: "/org/students" },
            { label: "Materials", href: "/org/materials" },
            { label: "Projects", href: "/org/projects" },
            { label: "Placements", href: "/org/placements" },
            { label: "Members", href: "/org/members" },
            { label: "Curriculum", href: "/admin/curriculum" },
          ],
        },
        { label: "Intelligence", items: [{ label: "Insights", href: "/org/insights" }, { label: "Outcomes", href: "/org/outcomes" }] },
      ];
    case "staff":
      return [
        { label: "Visibility", items: [HOME, POSTS("Posts")] },
        {
          label: "Operations",
          items: [
            { label: "Students", href: "/org/students" },
            { label: "Materials", href: "/org/materials" },
            { label: "Projects", href: "/org/projects" },
          ],
        },
      ];
    case "tpo":
      return [
        { label: "Visibility", items: [HOME] },
        { label: "Operations", items: [{ label: "Placements", href: "/org/placements" }] },
        { label: "Intelligence", items: [{ label: "Insights", href: "/org/insights" }, { label: "Outcomes", href: "/org/outcomes" }] },
      ];
    default:
      return [];
  }
}

/** Flat list (used by Home's "where next" and tests). */
export function orgNavFor(kind: OrgKind): OrgNavItem[] {
  return orgNavGroupsFor(kind).flatMap((g) => g.items);
}

export const ROLE_LABEL: Record<string, string> = {
  faculty: "Faculty",
  hod: "Head of Department",
  principal: "Principal",
  vice_principal: "Vice Principal",
  tpo: "Training & Placement Officer",
};
