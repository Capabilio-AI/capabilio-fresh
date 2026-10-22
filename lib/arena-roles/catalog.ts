/**
 * The 45-role Arena catalog: the one place that names every role, its stream and its stable ID.
 *
 * `domainRoleKey` links a catalog role to the existing `arena_domain_roles.role_key` that serves it today. It is `null` while no workstation exists,
 * and a role with `null` must show an "unavailable" state -- never another role's tickets. Two catalog roles may NOT share a `domainRoleKey`
 * unless the shared row is deliberately listed in SHARED_DOMAIN_ROLE_KEYS (a known overlap to be split during that role's own work).
 *
 * Status here is about the catalog only. Whether a role is actually complete lives in docs/arena-roles/implementation-log.md, after its gate.
 */

export const STREAMS = ["IT", "ECE", "EEE", "CIVIL", "MECH", "MBA", "MCA"] as const;
export type StreamId = (typeof STREAMS)[number];

export interface CatalogRole {
  /** stable, never reused: `<STREAM>-<NN>` */
  id: string;
  stream: StreamId;
  name: string;
  /** build order, 1..45 */
  order: number;
  /** existing arena_domain_roles.role_key that serves this role today, or null when there is no workstation yet */
  domainRoleKey: string | null;
}

const role = (stream: StreamId, n: number, name: string, domainRoleKey: string | null = null): Omit<CatalogRole, "order"> => ({
  id: `${stream}-${String(n).padStart(2, "0")}`,
  stream,
  name,
  domainRoleKey,
});

const ORDERED: Omit<CatalogRole, "order">[] = [
  role("IT", 1, "Data Analyst", "data-analyst"),
  role("IT", 2, "Backend Developer"), // migration 113 defines `backend-developer`, but it is not applied to production (verified 2026-10-22)
  role("IT", 3, "Frontend Developer", "frontend-developer"),
  role("IT", 4, "Full Stack Developer"),
  role("IT", 5, "Data Engineer", "data-engineer-sql"),
  role("IT", 6, "BI Developer", "bi-developer"),
  role("IT", 7, "AI/ML Engineer", "ai-ml-engineer"),
  role("IT", 8, "Data Scientist"), // today the AI/ML keywords also match "data scientist"; it gets its own role when IT-08 is built
  role("IT", 9, "DevOps Engineer", "devops-engineer"),
  role("IT", 10, "Cloud Engineer", "cloud-engineer"),
  role("IT", 11, "SOC Analyst / Cybersecurity Operations Analyst"),
  role("IT", 12, "Penetration Testing / Application Security Associate"),
  role("IT", 13, "Database Administrator / SQL Developer", "database-admin"), // `sql-developer` is a separate row today; resolved in IT-13
  role("IT", 14, "Software Development Engineer / Programmer", "programming-languages"),
  role("IT", 15, "QA Automation Engineer"),

  role("ECE", 1, "Embedded Systems Engineer"),
  role("ECE", 2, "VLSI Design / Verification Engineer"),
  role("ECE", 3, "Electronics Design Engineer"),
  role("ECE", 4, "Communication / RF Engineer"),
  role("ECE", 5, "Electronics Test and Validation Engineer"),

  role("EEE", 1, "Electrical Design Engineer"),
  role("EEE", 2, "Power Systems Engineer"),
  role("EEE", 3, "Industrial Automation / PLC Engineer"),
  role("EEE", 4, "Electrical Maintenance Engineer"),
  role("EEE", 5, "Renewable Energy / Solar Design Engineer"),

  role("CIVIL", 1, "Site Engineer"),
  role("CIVIL", 2, "Quantity Surveyor / Estimation Engineer"),
  role("CIVIL", 3, "Structural Design Engineer"),
  role("CIVIL", 4, "Planning and Project Controls Engineer"),
  role("CIVIL", 5, "QA/QC and Materials Testing Engineer"),

  role("MECH", 1, "Mechanical Design Engineer"),
  role("MECH", 2, "Manufacturing / Production Engineer"),
  role("MECH", 3, "Quality Engineer"),
  role("MECH", 4, "Maintenance / Reliability Engineer"),
  role("MECH", 5, "Thermal / HVAC Engineer"),

  role("MBA", 1, "Business Analyst"),
  role("MBA", 2, "Financial Analyst"),
  role("MBA", 3, "Marketing / Growth Analyst"),
  role("MBA", 4, "HR / Talent Acquisition Associate"),
  role("MBA", 5, "Operations / Supply Chain Analyst"),

  role("MCA", 1, "Application Developer"),
  role("MCA", 2, "Enterprise Software / ERP Developer"),
  role("MCA", 3, "Database and Data Applications Engineer"),
  role("MCA", 4, "Cloud and Platform Support Engineer"),
  role("MCA", 5, "Software Test Automation Engineer"),
];

export const ROLE_CATALOG: readonly CatalogRole[] = ORDERED.map((r, i) => ({ ...r, order: i + 1 }));

/** How many roles each stream must have. */
export const STREAM_SIZES: Readonly<Record<StreamId, number>> = { IT: 15, ECE: 5, EEE: 5, CIVIL: 5, MECH: 5, MBA: 5, MCA: 5 };

const BY_ID = new Map(ROLE_CATALOG.map((r) => [r.id, r]));

/** Exact lookup. Returns null for an unknown ID -- there is no fuzzy matching and no fallback role. */
export function catalogRole(id: string): CatalogRole | null {
  return BY_ID.get(id) ?? null;
}

/** The catalog role served by an existing arena_domain_roles row, or null. If several catalog roles share a row the lowest build order wins. */
export function catalogRoleForDomainKey(domainRoleKey: string): CatalogRole | null {
  return ROLE_CATALOG.find((r) => r.domainRoleKey === domainRoleKey) ?? null;
}
