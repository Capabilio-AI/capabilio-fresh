import { URBANKART_SCHEMA, URBANKART_SEED_SQL, type SchemaTable } from "./urbankart";

export interface DomainRole {
  key: string;
  label: string;
  company: string;
  companyBlurb: string;
  seedSql: string;
  schema: SchemaTable[];
  keywords: string[];
}

// Only Data Analyst is live; add a role here (plus its dataset and tickets)
// to open another workstation.
export const DATA_ANALYST: DomainRole = {
  key: "data-analyst",
  label: "Data Analyst",
  company: "UrbanKart",
  companyBlurb: "D2C e-commerce · Analytics team",
  seedSql: URBANKART_SEED_SQL,
  schema: URBANKART_SCHEMA,
  keywords: ["data analyst", "data analytics", "sql analyst", "reporting analyst", "analytics", "business intelligence", "bi analyst", "power bi", "tableau"],
};

/** Pure. Whether the student's own stated career interest points at this role. */
export function statedRoleMatches(role: DomainRole, statedRole: string | null): boolean {
  if (!statedRole) return false;
  const text = statedRole.toLowerCase();
  return role.keywords.some((k) => text.includes(k));
}
