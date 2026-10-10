import { getCareerProfile } from "@/lib/assess/career-profile";
import type { Db } from "@/lib/assess/db";
import { passportSkills, type PassportSkill } from "./badges";

export interface PassportSkills {
  /** false until the career assessment is analysed: no badge exists before then */
  unlocked: boolean;
  roleName: string | null;
  skills: PassportSkill[];
  updatedAt: string | null;
  snapshotId: string | null;
  /** the shared ELO ledger for the primary career; null until the first snapshot */
  elo: { rating: number; history: { at: string; rating: number }[] } | null;
}

/** The badges a student has earned, from the same snapshot every other surface reads. */
export async function loadPassportSkills(db: Db, userId: string): Promise<PassportSkills> {
  const profile = await getCareerProfile(db, userId);
  return { unlocked: profile.unlocked && profile.skills.length > 0, roleName: profile.role?.name ?? null, skills: passportSkills(profile.skills), updatedAt: profile.updatedAt, snapshotId: profile.snapshotId, elo: profile.elo ? { rating: profile.elo.rating, history: profile.elo.history.map((h) => ({ at: h.at, rating: h.newRating })) } : null };
}
