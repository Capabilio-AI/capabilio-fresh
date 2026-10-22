export type ExecutionMode = "executed" | "computed-key" | "evaluated-spec" | "none";

export interface BlueprintCompetency {
  id: string;
  label: string;
}

export interface BlueprintArea {
  /** arena_skill_areas.area_key */
  areaKey: string;
  toolType: string;
  generationVersion: string;
  gradingVersion: string;
  executionMode: ExecutionMode;
  /** "blocked" areas are declared but never served */
  status: "enabled" | "blocked";
  blockedReason?: string;
  competencies: string[];
}

export interface RoleBlueprint {
  /** catalog id, e.g. IT-01 */
  roleId: string;
  /** arena_domain_roles.role_key this blueprint describes */
  domainRoleKey: string;
  name: string;
  competencies: BlueprintCompetency[];
  areas: BlueprintArea[];
  limitations: string[];
}

/** Pure. Structural problems with a blueprint; an empty list means it is well-formed. */
export function validateBlueprint(b: RoleBlueprint): string[] {
  const problems: string[] = [];
  const ids = new Set(b.competencies.map((c) => c.id));
  if (ids.size !== b.competencies.length) problems.push("duplicate competency id");
  const keys = new Set(b.areas.map((a) => a.areaKey));
  if (keys.size !== b.areas.length) problems.push("duplicate area key");

  const covered = new Set<string>();
  for (const a of b.areas) {
    for (const c of a.competencies) {
      if (!ids.has(c)) problems.push(`area ${a.areaKey} maps to unknown competency ${c}`);
      covered.add(c);
    }
    if (a.status === "blocked" && (!a.blockedReason || a.executionMode !== "none")) problems.push(`blocked area ${a.areaKey} needs a reason and execution mode "none"`);
    if (a.status === "enabled" && (a.executionMode === "none" || a.competencies.length === 0)) problems.push(`enabled area ${a.areaKey} needs an execution mode and competencies`);
  }
  for (const c of b.competencies) if (!covered.has(c.id)) problems.push(`competency ${c.id} is not assessed by any area`);
  return problems;
}
