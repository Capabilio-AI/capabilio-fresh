export interface ArenaWorkArea {
  areaKey: string;
  areaName: string;
  verifiedCount: number;
  lastPassedAt: string | null;
}

export interface ArenaWorkRole {
  roleKey: string;
  roleName: string;
  verifiedCount: number;
  lastPassedAt: string | null;
  areas: ArenaWorkArea[];
}

interface RatingRow {
  role_key: string;
  area_key: string;
  verified_count: number;
  last_verified_at: string | null;
}

const latest = (a: string | null, b: string | null) => (!a ? b : !b ? a : a > b ? a : b);

/**
 * Pure. Graded Arena work per role and skill area, from arena_skill_ratings (one row per area, counted by the completion RPC on every verified
 * attempt, so counts are exact rather than limited to the recent task list). Rows with no verified attempt are dropped: a rating seeded from the
 * assessment is not work. Names fall back to the key when a role or area row is missing.
 */
export function summariseArenaWork(
  ratings: RatingRow[],
  roles: { role_key: string; display_name: string }[],
  areas: { role_key: string; area_key: string; display_name: string }[]
): ArenaWorkRole[] {
  const byRole = new Map<string, ArenaWorkArea[]>();
  for (const r of ratings) {
    if (r.verified_count <= 0) continue;
    const areaName = areas.find((a) => a.role_key === r.role_key && a.area_key === r.area_key)?.display_name ?? r.area_key;
    byRole.set(r.role_key, [...(byRole.get(r.role_key) ?? []), { areaKey: r.area_key, areaName, verifiedCount: r.verified_count, lastPassedAt: r.last_verified_at }]);
  }
  return [...byRole.entries()]
    .map(([roleKey, list]) => ({
      roleKey,
      roleName: roles.find((x) => x.role_key === roleKey)?.display_name ?? roleKey,
      verifiedCount: list.reduce((n, a) => n + a.verifiedCount, 0),
      lastPassedAt: list.reduce<string | null>((d, a) => latest(d, a.lastPassedAt), null),
      areas: [...list].sort((a, b) => b.verifiedCount - a.verifiedCount || a.areaName.localeCompare(b.areaName)),
    }))
    .sort((a, b) => b.verifiedCount - a.verifiedCount || a.roleName.localeCompare(b.roleName));
}
