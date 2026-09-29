// Spec roles -> app_role. One role per person per institution (UNIQUE(user_id, institution_id)).
export type OrgKind = "student" | "staff" | "admin" | "tpo";

const KIND_BY_ROLE: Record<string, OrgKind> = {
  student: "student",
  faculty: "staff",
  hod: "staff",
  principal: "admin",
  vice_principal: "admin",
  tpo: "tpo",
};

export function kindOf(role: string): OrgKind | null {
  return KIND_BY_ROLE[role] ?? null;
}

/** Roles that keep the operator-only rule: admins cannot approve other admins in-app. */
export const IN_APP_APPROVABLE_ROLES = ["faculty", "hod", "tpo"] as const;

// The permissions matrix (docs: Organisation Path §6). Ownership ("own projects/posts") is checked
// where the row is known; these gate the kind of action.
export const PERMISSIONS = {
  createProject: ["staff", "admin"],
  uploadMaterial: ["staff", "admin"],
  gradeProject: ["staff", "admin"],
  publishPost: ["staff", "admin"],
  manageProfile: ["admin"],
  approveMembers: ["admin"],
  postPlacement: ["tpo", "admin"],
  viewInsights: ["tpo", "admin"],
  joinGroup: ["student"],
} as const satisfies Record<string, readonly OrgKind[]>;

export type Permission = keyof typeof PERMISSIONS;

export function allowed(kind: OrgKind | null, permission: Permission): boolean {
  return kind !== null && (PERMISSIONS[permission] as readonly OrgKind[]).includes(kind);
}

/** Where a signed-in user of this role lands after login. null = no workspace built for the role. */
export function landingFor(role: string): string | null {
  const kind = kindOf(role);
  if (kind === "student") return "/assessment";
  return kind ? "/org" : null;
}
