import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getCareerProfile } from "@/lib/assess/career-profile";
import type { Db } from "@/lib/assess/db";
import { loadStudentCapabilities } from "@/lib/capability/read-model";
import { loadSkillNames } from "@/lib/skills/store";
import { PRACTICAL_KINDS, passportSkills, type PassportSkill, type SkillInput } from "./badges";

export interface PassportSkills {
  /** false until the career assessment is analysed: the passport shows nothing before then */
  unlocked: boolean;
  roleName: string | null;
  skills: PassportSkill[];
  updatedAt: string | null;
  snapshotId: string | null;
  /** the shared ELO ledger for the primary career; null until the first snapshot */
  elo: { rating: number; fromAssessment: number; fromArena: number; history: { at: string; rating: number }[] } | null;
}

/**
 * The passport: every skill the target role asks for, plus any other skill the student has demonstrated, each with the work behind it. A badge
 * needs demonstrated work (see badges.ts); the assessment only shows as a baseline. Same capability model every other surface reads.
 */
export async function loadPassportSkills(service: SupabaseClient<Database>, userId: string, now: Date = new Date()): Promise<PassportSkills> {
  const [profile, capabilities, names] = await Promise.all([getCareerProfile(service as unknown as Db, userId), loadStudentCapabilities(service, userId, now), loadSkillNames(service)]);

  const roleSkills = new Map(profile.skills.map((s) => [s.skillId, s.name]));
  // skills outside the role's list count too when real work backs them (an Arena task in another domain should never vanish)
  const demonstrated = [...capabilities.bySkill].filter(([, c]) => c.lines.some((l) => PRACTICAL_KINDS.has(l.kind))).map(([id]) => id);
  const inputs: SkillInput[] = [...new Set([...roleSkills.keys(), ...demonstrated])].flatMap((skillId) => {
    const name = roleSkills.get(skillId) ?? names.get(skillId);
    return name ? [{ skillId, name, lines: capabilities.bySkill.get(skillId)?.lines ?? [] }] : [];
  });

  return {
    unlocked: profile.unlocked && profile.skills.length > 0,
    roleName: profile.role?.name ?? null,
    skills: passportSkills(inputs),
    updatedAt: profile.updatedAt,
    snapshotId: profile.snapshotId,
    elo: profile.elo ? { rating: profile.elo.rating, fromAssessment: profile.elo.fromAssessment, fromArena: profile.elo.fromArena, history: profile.elo.history.map((h) => ({ at: h.at, rating: h.newRating })) } : null,
  };
}
