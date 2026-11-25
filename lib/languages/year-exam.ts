import type { SupabaseClient } from "@supabase/supabase-js";
import { findTrack } from "./index";
import { levelsOf, provenLevels } from "./levels";
import { isProven, type ModuleProofRow } from "./module-gate";
import { loadModuleProofs } from "./module-proof";
import { canAttemptTier, type TierNumber } from "./tiers";
import type { Track } from "./types";
import { isProofArea, loadProvenTiers, proofReady } from "./tier-proof";

/** The year exams a student has passed in a language (levels 1 to 4). */
export const loadExamLevels = (service: SupabaseClient, userId: string, trackKey: string): Promise<TierNumber[]> => loadProvenTiers(service, userId, `lang-${trackKey}`);

export type ExamGate = { ok: true; proven: TierNumber[]; language: string | null } | { ok: false; status: number; error: string };

/**
 * May this student take this proof exam now? For a language's year exam: the level's own modules must all be proven (the assessments and coding problems of that year) and
 * the year below must be passed. `language` is the one language the exam must be written in, or null when any language is fine (Basic Programming).
 */
export async function examGate(service: SupabaseClient, userId: string, area: unknown, tier: TierNumber): Promise<ExamGate> {
  if (!isProofArea(area) || !proofReady(area)) return { ok: false, status: 409, error: "This area's proof test is not open yet." };
  const proven = await loadProvenTiers(service, userId, area);
  if (!canAttemptTier(tier, proven)) return { ok: false, status: 403, error: "Prove the level before this one first." };
  if (!area.startsWith("lang-")) return { ok: true, proven, language: null };
  const track = findTrack(area.slice(5));
  if (!track) return { ok: false, status: 404, error: "Unknown language." };
  const rows = await loadModuleProofs(service, userId, track.key);
  const open = levelsOf(track)[tier - 1]?.modules.every((m) => isProven(track, m, rows[m.key])) ?? false;
  if (!open) return { ok: false, status: 403, error: "Prove every module of this level first. Then you can take its exam." };
  return { ok: true, proven, language: track.runnerLanguage };
}

/** The Capabilio Certificate needs all four levels of the language: every module proven and, where the language has one, every year exam passed. */
export async function allLevelsProven(service: SupabaseClient, userId: string, track: Track, proofs: Readonly<Record<string, ModuleProofRow>>): Promise<boolean> {
  return provenLevels(track, (m) => isProven(track, m, proofs[m.key]), await loadExamLevels(service, userId, track.key)).length === 4;
}
