// Arena -> the SAME ELO ledger and skill graph as the assessment. There is no second rating anywhere: a verified Arena pass is an
// elo_event (source ARENA) on student_career_elo, plus skill evidence, a fresh skill-graph snapshot and, when the rating crosses
// a milestone, a roadmap refresh.

import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncSkillGraph } from "./graph-sync";
import { refreshRoadmap } from "./roadmap";
import { track, type Db } from "./db";
import { ARENA_DIFFICULTY_SCALE, crossedMilestone, extraEvidenceId, scaleForElo } from "./arena-rules";

export interface ArenaPass {
  attemptId: string;
  roleKey: string;
  skillId: string | null;
  /** A catalog challenge can exercise several skills; each gets its own evidence row (the first reuses the attempt id as its key). */
  extraSkillIds?: string[];
  difficulty: keyof typeof ARENA_DIFFICULTY_SCALE;
  /** The ELO the challenge advertised and awarded; when set it is applied exactly, instead of the generic difficulty scale. */
  elo?: number;
}

/** One evidence row per skill the ticket exercises (the first reuses the attempt id as its key); a miss writes the same rows with correct = false, so the skill scores move both ways. */
async function writeArenaEvidence(db: Db, userId: string, careerId: string, t: { attemptId: string; skillId: string | null; extraSkillIds?: string[]; difficulty: keyof typeof ARENA_DIFFICULTY_SCALE }, correct: boolean): Promise<void> {
  const skillIds = [...new Set([t.skillId, ...(t.extraSkillIds ?? [])].filter((id): id is string => Boolean(id)))];
  const { data: skillRows } = skillIds.length ? await db.from("skills").select("id, name").in("id", skillIds) : { data: [] };
  const skillName = new Map((skillRows ?? []).map((r) => [r.id, r.name]));
  for (const [i, skillId] of skillIds.entries()) {
    await db.from("student_skill_evidence").upsert(
      { student_id: userId, career_id: careerId, skill_id: skillId, skill_label: skillName.get(skillId) ?? "Arena skill", source: "ARENA", source_id: i === 0 ? t.attemptId : extraEvidenceId(t.attemptId, skillId), correct, difficulty: t.difficulty.toUpperCase() },
      { onConflict: "source,source_id", ignoreDuplicates: true }
    );
  }
}

/**
 * Called once a challenge is verified as passed: the rating goes up by what the ticket advertised. A wrong answer is recorded separately by
 * recordArenaMiss and costs rating. The ledger is idempotent per attempt, so a replay changes nothing. Never throws:
 * a problem here must not undo an Arena result that was already recorded.
 */
export async function recordArenaPass(userId: string, pass: ArenaPass, db: Db = createServiceClient() as unknown as Db): Promise<{ elo: number; change: number } | null> {
  try {
    const { data: career } = await db.from("careers").select("id").eq("key", pass.roleKey).eq("is_active", true).maybeSingle();
    if (!career) return null;

    const { data, error } = await db.rpc("apply_elo_event", {
      p_student: userId, p_career: career.id, p_source: "ARENA", p_source_id: pass.attemptId, p_correct: true,
      p_reason: `Arena ${pass.difficulty} challenge passed`, p_scale: pass.elo && pass.elo > 0 ? scaleForElo(pass.elo) : ARENA_DIFFICULTY_SCALE[pass.difficulty],
    });
    if (error) throw error;
    const ev = data as { previous: number; change: number; newRating: number; replayed: boolean };
    if (ev.replayed) return { elo: ev.newRating, change: ev.change };

    await writeArenaEvidence(db, userId, career.id, pass, true);

    await syncSkillGraph(db, userId, career.id, "ARENA");
    await track(db, userId, "elo_updated", { source: "ARENA", change: ev.change, newRating: ev.newRating, attemptId: pass.attemptId });

    if (crossedMilestone(ev.previous, ev.newRating)) {
      try { after(() => refreshRoadmap(userId)); } catch { void refreshRoadmap(userId); } // `after` needs a request scope; scripts have none
    }
    return { elo: ev.newRating, change: ev.change };
  } catch (e) {
    console.error("[assess] recording Arena progress failed:", e);
    return null;
  }
}

export interface ArenaMiss {
  attemptId: string;
  roleKey: string;
  /** both negative: what the wrong answer takes from the career ELO and from the skill area's rating */
  careerChange: number;
  areaChange: number;
  reason: string;
  /** the skills the ticket exercised: a miss is evidence too, so the skill graph and dashboard move on it */
  skillId?: string | null;
  extraSkillIds?: string[];
  difficulty?: keyof typeof ARENA_DIFFICULTY_SCALE;
  /** the Domain streak after this ticket closed, in the shape complete_workstation_attempt takes; the miss moves the streak like a pass does */
  streak?: { current_streak: number; longest_streak: number; last_completed_week: string | null };
}

/**
 * A final wrong answer lowers the two ratings a pass raises, by amounts worked out from the answer (see missChange). The database applies it atomically and at
 * most once per ticket, and never below the floor. This does not use the assessment's fixed +4 / -2 rule. Never throws: a problem here must not break grading.
 */
export async function recordArenaMiss(userId: string, miss: ArenaMiss, db: Db = createServiceClient() as unknown as Db): Promise<{ careerChange: number; areaChange: number } | null> {
  try {
    const { data: career } = await db.from("careers").select("id").eq("key", miss.roleKey).eq("is_active", true).maybeSingle();
    if (!career) return null;
    const { data, error } = await db.rpc("apply_arena_miss", { p_attempt: miss.attemptId, p_career: career.id, p_career_change: miss.careerChange, p_area_change: miss.areaChange, p_streak: miss.streak ?? null, p_reason: miss.reason });
    if (error) throw error;
    const r = data as { careerChange: number; areaChange: number; careerRating?: number; replayed: boolean };
    if (!r.replayed) {
      await track(db, userId, "elo_updated", { source: "ARENA", change: r.careerChange, newRating: r.careerRating ?? null, attemptId: miss.attemptId, miss: true });
      await writeArenaEvidence(db, userId, career.id, { attemptId: miss.attemptId, skillId: miss.skillId ?? null, extraSkillIds: miss.extraSkillIds, difficulty: miss.difficulty ?? "easy" }, false);
      await syncSkillGraph(db, userId, career.id, "ARENA");
    }
    return { careerChange: r.careerChange, areaChange: r.areaChange };
  } catch (e) {
    console.error("[assess] recording an Arena miss failed:", e);
    return null;
  }
}
