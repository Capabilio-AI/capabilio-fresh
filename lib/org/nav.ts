import { CALENDAR_ROLES, type OrgPermissionKey } from "./roles";

export interface OrgNavItem {
  label: string;
  href: string;
  /** other pages that live under this entry as tabs: the entry stays highlighted on them */
  alsoActiveFor?: string[];
}

export interface OrgNavGroup {
  label: string;
  items: OrgNavItem[];
}

interface Candidate extends OrgNavItem {
  /** null = every organisation member */
  needs: OrgPermissionKey | null;
  /** roles that see this page even without the permission */
  alsoRoles?: readonly string[];
  /** this page is a tab inside the entry that needs this permission: its own link is hidden for anyone who can open that entry */
  tabOf?: OrgPermissionKey;
}

// Grouped like the reference Institution OS (Visibility / Operations / Intelligence / Team). An item appears only
// when the member holds its permission; server routes and pages re-check regardless.
const GROUPS: { label: string; items: Candidate[] }[] = [
  {
    label: "Visibility",
    items: [
      { label: "Home", href: "/org", needs: null },
      { label: "College page", href: "/org/college", needs: null },
    ],
  },
  {
    label: "Operations",
    items: [
      { label: "Students", href: "/org/students", needs: "students" },
      { label: "Materials", href: "/org/materials", needs: "classroom" },
      { label: "Projects", href: "/org/projects", needs: "classroom" },
      { label: "Company visits", href: "/org/placements", needs: "placements" },
      { label: "Curriculum", href: "/org/curriculum", needs: "curriculum", alsoActiveFor: ["/org/calendar"] },
      { label: "Academic calendar", href: "/org/calendar", needs: "page", alsoRoles: CALENDAR_ROLES, tabOf: "curriculum" },
      { label: "Team & access", href: "/org/team", needs: "members", alsoActiveFor: ["/org/chat"] },
    ],
  },
  {
    label: "Intelligence",
    items: [
      { label: "Career intent", href: "/org/career", needs: "placements" },
      { label: "Insights", href: "/org/insights", needs: "insights" },
      { label: "Outcomes", href: "/org/outcomes", needs: "outcomes" },
    ],
  },
  { label: "Collaboration", items: [{ label: "Team chat", href: "/org/chat", needs: "chat", tabOf: "members" }] },
];

export function orgNavGroupsFor(permissions: ReadonlySet<OrgPermissionKey>, role?: string | null): OrgNavGroup[] {
  return GROUPS.map((g) => ({
    label: g.label,
    items: g.items
      .filter((i) => (i.needs === null || permissions.has(i.needs) || Boolean(role && i.alsoRoles?.includes(role))) && !(i.tabOf && permissions.has(i.tabOf)))
      .map(({ label, href, alsoActiveFor }) => (alsoActiveFor ? { label, href, alsoActiveFor } : { label, href })),
  })).filter((g) => g.items.length > 0);
}

/** Flat list (used by tests). */
export function orgNavFor(permissions: ReadonlySet<OrgPermissionKey>, role?: string | null): OrgNavItem[] {
  return orgNavGroupsFor(permissions, role).flatMap((g) => g.items);
}

export const ROLE_LABEL: Record<string, string> = {
  faculty: "Faculty",
  hod: "Head of Department",
  principal: "Principal",
  vice_principal: "Vice Principal",
  tpo: "Training & Placement Officer",
};
