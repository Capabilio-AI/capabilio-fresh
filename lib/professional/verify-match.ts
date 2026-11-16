import type { EpfoRecord, TimelineRole } from "./types";

const NOISE = /\b(pvt|private|ltd|limited|llp|inc|corp|corporation|technologies|technology|solutions|services|india|software|systems|the)\b/g;

/** "Infosys Ltd." and "INFOSYS LIMITED" are the same employer. */
export function normaliseCompany(name: string): string {
  return name.toLowerCase().replace(/[^a-z0-9 ]/g, " ").replace(NOISE, " ").replace(/\s+/g, " ").trim();
}

const toMs = (iso: string | null) => (iso ? Date.parse(`${iso}T00:00:00Z`) : Date.now());
const WEEK_FUZZ = 45 * 86_400_000; // EPFO records months, resumes record "Jan 2019": allow a month and a half either side

function sameEmployer(a: string, b: string): boolean {
  const x = normaliseCompany(a);
  const y = normaliseCompany(b);
  return x.length > 0 && y.length > 0 && (x === y || x.startsWith(y) || y.startsWith(x));
}

function overlaps(role: TimelineRole, rec: EpfoRecord): boolean {
  return toMs(role.start) <= toMs(rec.to) + WEEK_FUZZ && toMs(rec.from) <= toMs(role.end) + WEEK_FUZZ;
}

export type MatchStatus = "verified" | "self_claimed" | "dates_differ";
export interface RoleMatch {
  roleId: string;
  status: MatchStatus;
  /** The EPFO dates when the employer matched but the dates did not. */
  epfo?: EpfoRecord;
}

/** Compare each resume role with the vendor's EPFO history. A mismatch is reported, never silently overwritten. */
export function matchRoles(resume: readonly TimelineRole[], epfo: readonly EpfoRecord[]): RoleMatch[] {
  return resume.map((role) => {
    const sameCo = epfo.filter((e) => sameEmployer(role.company, e.establishment));
    const hit = sameCo.find((e) => overlaps(role, e));
    if (hit) return { roleId: role.id, status: "verified" as const };
    return sameCo.length ? { roleId: role.id, status: "dates_differ" as const, epfo: sameCo[0] } : { roleId: role.id, status: "self_claimed" as const };
  });
}
