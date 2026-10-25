export type DomainSource = "workstation" | "catalog" | "none";

/**
 * Pure. Which ticket system serves a student's Domain page.
 * A role workstation (per-student AI tickets, several tools) always wins when the student's role has one; the fixed catalog tickets are only used
 * for a career that has no workstation. Catalog tickets must never hide a workstation. "none" means neither exists: show the unavailable notice.
 */
export function chooseDomainSource(input: { hasWorkstation: boolean; catalogItems: number; catalogCountdown: boolean }): DomainSource {
  if (input.hasWorkstation) return "workstation";
  if (input.catalogItems > 0 || input.catalogCountdown) return "catalog";
  return "none";
}
