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

// ---------------------------------------------------------------------------------------------------------
// Permission sets. A member's role gives a default set; the admin can grant a custom set per person.
// Admin roles (principal / vice principal) always hold everything. Mirrors SQL org_effective_permissions().
// ---------------------------------------------------------------------------------------------------------
export const ORG_PERMISSIONS = [
  { key: "students", label: "Students", hint: "See the college's student roster" },
  { key: "classroom", label: "Classroom", hint: "Share materials, run projects and grade groups" },
  { key: "posts", label: "Posts", hint: "Publish events and announcements" },
  { key: "page", label: "College page", hint: "Edit the logo, cover, about and details" },
  { key: "placements", label: "Company visits", hint: "Record company visits, review applicants, confirm placements" },
  { key: "outcomes", label: "Outcomes", hint: "See placement results and export them" },
  { key: "insights", label: "Insights", hint: "See aggregate cohort insights" },
  { key: "members", label: "Team & access", hint: "Invite staff, share student links, change permissions" },
  { key: "curriculum", label: "Curriculum", hint: "Manage subjects and skill mapping" },
  { key: "chat", label: "Team chat", hint: "Use the staff chat" },
] as const;

export type OrgPermissionKey = (typeof ORG_PERMISSIONS)[number]["key"];
export const ALL_PERMISSION_KEYS: readonly OrgPermissionKey[] = ORG_PERMISSIONS.map((p) => p.key);

export const ROLE_DEFAULTS: Record<OrgKind, readonly OrgPermissionKey[]> = {
  admin: ALL_PERMISSION_KEYS,
  staff: ["students", "classroom", "posts", "chat"],
  tpo: ["placements", "outcomes", "insights", "chat"],
  student: [],
};

const isPermissionKey = (v: string): v is OrgPermissionKey => (ALL_PERMISSION_KEYS as readonly string[]).includes(v);

/** `custom` = the membership's stored permissions (null = role default). Admin roles ignore it. */
export function effectivePermissions(role: string, custom: readonly string[] | null | undefined): ReadonlySet<OrgPermissionKey> {
  const kind = kindOf(role);
  if (!kind) return new Set();
  if (kind === "admin") return new Set(ALL_PERMISSION_KEYS);
  if (custom) return new Set(custom.filter(isPermissionKey));
  return new Set(ROLE_DEFAULTS[kind]);
}

/** Roles an admin may invite. Principal stays operator-approved (it is the account owner). */
export const INVITABLE_ROLES = [
  { role: "faculty", label: "Faculty" },
  { role: "hod", label: "Head of Department" },
  { role: "tpo", label: "Training & Placement Officer" },
  { role: "vice_principal", label: "Vice Principal (full access)" },
] as const;
export type InvitableRole = (typeof INVITABLE_ROLES)[number]["role"];

/** Roles an admin may approve in-app when someone registers with the college's name. */
export const IN_APP_APPROVABLE_ROLES = ["faculty", "hod", "tpo"] as const;

// Actions -> the permission that gates them. Student actions are role-only (kind === "student").
const ACTION_PERMISSION = {
  createProject: "classroom",
  uploadMaterial: "classroom",
  gradeProject: "classroom",
  publishPost: "posts",
  manageProfile: "page",
  approveMembers: "members",
  postPlacement: "placements",
  viewInsights: "insights",
  viewOutcomes: "outcomes",
  viewRoster: "students",
  manageCurriculum: "curriculum",
  useChat: "chat",
} as const satisfies Record<string, OrgPermissionKey>;

const STUDENT_ACTIONS = ["joinGroup", "applyToDrive"] as const;

export type Permission = keyof typeof ACTION_PERMISSION | (typeof STUDENT_ACTIONS)[number];

export interface PermissionSubject {
  kind: OrgKind | null;
  permissions: ReadonlySet<OrgPermissionKey>;
}

export function can(subject: PermissionSubject | null, action: Permission): boolean {
  if (!subject || !subject.kind) return false;
  if ((STUDENT_ACTIONS as readonly string[]).includes(action)) return subject.kind === "student";
  if (subject.kind === "student") return false;
  return subject.permissions.has(ACTION_PERMISSION[action as keyof typeof ACTION_PERMISSION]);
}

/** Where a signed-in user of this role lands after login. null = no workspace built for the role. */
export function landingFor(role: string): string | null {
  const kind = kindOf(role);
  if (kind === "student") return "/assessment";
  return kind ? "/org" : null;
}
