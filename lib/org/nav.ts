import type { OrgPermissionKey } from "./roles";

export interface OrgNavItem {
  label: string;
  href: string;
}

export interface OrgNavGroup {
  label: string;
  items: OrgNavItem[];
}

interface Candidate extends OrgNavItem {
  /** null = every organisation member */
  needs: OrgPermissionKey | null;
}

// Grouped like the reference Institution OS (Visibility / Operations / Intelligence / Team). An item appears only
// when the member holds its permission; server routes and pages re-check regardless.
const GROUPS: { label: string; items: Candidate[] }[] = [
  {
    label: "Visibility",
    items: [
      { label: "Home", href: "/org", needs: null },
      { label: "College page", href: "/org/college", needs: null },
      { label: "Posts", href: "/org/posts", needs: "posts" },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Students", href: "/org/students", needs: "students" },
      { label: "Materials", href: "/org/materials", needs: "classroom" },
      { label: "Projects", href: "/org/projects", needs: "classroom" },
      { label: "Company visits", href: "/org/placements", needs: "placements" },
      { label: "Curriculum", href: "/org/curriculum", needs: "curriculum" },
      { label: "Team & access", href: "/org/team", needs: "members" },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Insights", href: "/org/insights", needs: "insights" },
      { label: "Outcomes", href: "/org/outcomes", needs: "outcomes" },
    ],
  },
  { label: "Collaboration", items: [{ label: "Team chat", href: "/org/chat", needs: "chat" }] },
];

export function orgNavGroupsFor(permissions: ReadonlySet<OrgPermissionKey>): OrgNavGroup[] {
  return GROUPS.map((g) => ({
    label: g.label,
    items: g.items.filter((i) => i.needs === null || permissions.has(i.needs)).map(({ label, href }) => ({ label, href })),
  })).filter((g) => g.items.length > 0);
}

/** Flat list (used by tests). */
export function orgNavFor(permissions: ReadonlySet<OrgPermissionKey>): OrgNavItem[] {
  return orgNavGroupsFor(permissions).flatMap((g) => g.items);
}

export const ROLE_LABEL: Record<string, string> = {
  faculty: "Faculty",
  hod: "Head of Department",
  principal: "Principal",
  vice_principal: "Vice Principal",
  tpo: "Training & Placement Officer",
};
