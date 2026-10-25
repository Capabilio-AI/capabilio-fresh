/** One skill as the Arena profile shows it. Pure: it only arranges what the capability model already knows. */
export const LEVEL_BANDS: readonly (readonly [number, string])[] = [[75, "Advanced"], [50, "Proficient"], [25, "Developing"], [0, "Beginner"]];

/** A missing measurement is "Not assessed", never a low level. */
export const levelLabel = (level: number | null): string => (level === null ? "Not assessed" : (LEVEL_BANDS.find(([min]) => level >= min) ?? LEVEL_BANDS[LEVEL_BANDS.length - 1])[1]);

export interface MatrixRow {
  skillId: string;
  name: string;
  /** 0-100, or null when nothing has been measured */
  level: number | null;
  label: string;
  verified: boolean;
  confidence: number | null;
  evidenceCount: number;
  arenaPasses: number;
  /** the level the user's target role asks for, when there is one */
  target: number | null;
  /** how many points short of the target a measured skill is (0 once met); null without a target or a measurement */
  gap: number | null;
  /** an Arena skill area that builds this skill, so a gap can link straight to practice */
  practise?: { areaKey: string; areaName: string };
}

export interface MatrixInput {
  capabilities: ReadonlyMap<string, { level: number | null; verified: boolean; confidence: number; evidenceCount: number }>;
  arenaPasses: ReadonlyMap<string, number>;
  names: ReadonlyMap<string, string>;
  practisable: ReadonlyMap<string, { areaKey: string; areaName: string }>;
  targets: ReadonlyMap<string, number>;
  /** when given, the matrix shows exactly these skills (the target role's) and nothing else the user happens to have measured */
  only?: ReadonlySet<string>;
  limit?: number;
}

/** Measured skills first (strongest first), then the skills Arena can build or the target role needs but nobody has measured yet. */
export function buildSkillMatrix({ capabilities, arenaPasses, names, practisable, targets, only, limit = 10 }: MatrixInput): MatrixRow[] {
  const ids = only ? new Set(only) : new Set([...capabilities.keys(), ...practisable.keys(), ...targets.keys()]);
  const rows = [...ids].flatMap((skillId): MatrixRow[] => {
    const name = names.get(skillId);
    if (!name) return [];
    const c = capabilities.get(skillId);
    const level = c?.level ?? null;
    const target = targets.get(skillId) ?? null;
    return [{
      skillId, name, level, label: levelLabel(level), verified: c?.verified ?? false, confidence: c ? c.confidence : null, evidenceCount: c?.evidenceCount ?? 0,
      arenaPasses: arenaPasses.get(skillId) ?? 0, target, gap: target !== null && level !== null ? Math.max(0, Math.round(target - level)) : null, practise: practisable.get(skillId),
    }];
  });
  rows.sort((a, b) => (b.level ?? -1) - (a.level ?? -1) || (b.target ?? 0) - (a.target ?? 0) || a.name.localeCompare(b.name));
  return rows.slice(0, limit);
}
