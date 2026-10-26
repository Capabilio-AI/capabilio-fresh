/**
 * What a student is told about a role's workstation before and during Arena work: the tools it models, what is preloaded, and what it can honestly
 * claim. One descriptor per role (lib/arena-roles/toolkit/<role>.ts), rendered by the Domain page. Tiers follow docs/arena-roles/workstation-design.md:
 * R = the real engine runs the work, S = a deterministic simulator of the tool's rules, A = an artifact checked by validators.
 */
export type WorkstationTier = "R" | "S" | "A";

export interface ToolkitWorkstation {
  /** what the student sees, e.g. "SQL Studio" */
  name: string;
  /** professional tools it mirrors, e.g. ["DBeaver", "pgAdmin"] */
  mirrors: string[];
  /** arena_skill_areas.tool_type that serves it */
  toolType: string;
  tier: WorkstationTier;
  runsIn: "browser" | "server";
  /** one sentence: what the student does here */
  summary: string;
}

export interface RoleToolkit {
  /** arena_domain_roles.role_key */
  roleKey: string;
  /** catalog id, e.g. IT-08 */
  roleId: string;
  /** stream shown to the student, e.g. "Data Science" */
  stream: string;
  headline: string;
  workstations: ToolkitWorkstation[];
  /** what is already set up for them: runtimes, libraries, datasets, accounts. Never install steps for their own machine. */
  environment: { label: string; detail: string }[];
  /** a fresher's first week in the role, as Arena tasks */
  firstWeek: string[];
  /** what a recruiter can open afterwards, tied to graded attempts */
  portfolioArtifacts: string[];
  /** what this role does not assess yet, said plainly */
  honestLimits: string[];
}

/** Pure. Structural problems; an empty list means the descriptor is usable. */
export function validateToolkit(t: RoleToolkit): string[] {
  const p: string[] = [];
  if (!t.workstations.length) p.push("no workstations");
  if (!t.environment.length) p.push("no environment");
  if (t.firstWeek.length < 3) p.push("first week needs at least 3 tasks");
  if (!t.portfolioArtifacts.length) p.push("no portfolio artifacts");
  if (!t.honestLimits.length) p.push("honest limits must be stated");
  for (const w of t.workstations) if (!w.mirrors.length) p.push(`${w.name} mirrors no real tool`);
  return p;
}
