// Arena -> the SAME ELO ledger and skill graph as the assessment. There is no second rating anywhere: a verified Arena pass is an
// elo_event (source ARENA) on student_career_elo, plus skill evidence, a fresh skill-graph snapshot and, when the rating crosses
// a milestone, a roadmap refresh.

import { after } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";
import { syncSkillGraph } from "./graph-sync";
import { refreshRoadmap } from "./roadmap";
import { track, type Db } from "./db";
import { ARENA_DIFFICULTY_SCALE, crossedMilestone, scaleForElo } from "./arena-rules";

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

/**
 * Called once a challenge is verified as passed. Only passes move the rating (a failed submission can be retried freely, so
 * punishing it would discourage exploration); the ledger is idempotent per attempt, so a replay changes nothing. Never throws:
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

    const skillIds = [...new Set([pass.skillId, ...(pass.extraSkillIds ?? [])].filter((id): id is string => Boolean(id)))];
    for (const [i, skillId] of skillIds.entries()) {
      const { data: skill } = await db.from("skills").select("name").eq("id", skillId).maybeSingle();
      await db.from("student_skill_evidence").upsert(
        { student_id: userId, career_id: career.id, skill_id: skillId, skill_label: skill?.name ?? "Arena skill", source: "ARENA", source_id: i === 0 ? pass.attemptId : `${pass.attemptId}:${skillId}`, correct: true, difficulty: pass.difficulty.toUpperCase() },
        { onConflict: "source,source_id", ignoreDuplicates: true }
      );
    }

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
