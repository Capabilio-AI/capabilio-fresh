// One place that turns "new evidence arrived" into the student's published numbers: skill scores, an append-only snapshot, and the
// career-profile everything else reads. Used by Arena, proof of work and (via finalize) the assessment, so they cannot drift apart.

import { computeSkillGraph } from "./finalize";
import { track, type Db } from "./db";

export type SnapshotTrigger = "ARENA" | "PROOF_OF_WORK";

/** Recomputes the role's graph from ALL evidence, upserts the skill scores, appends a snapshot at the current rating. */
export async function syncSkillGraph(db: Db, userId: string, careerId: string, trigger: SnapshotTrigger): Promise<{ readiness: number } | null> {
  const [{ data: elo }, graph] = await Promise.all([
    db.from("student_career_elo").select("rating").eq("student_id", userId).eq("career_id", careerId).maybeSingle(),
    computeSkillGraph(db, userId, careerId),
  ]);
  if (!elo) return null; // no rating yet means no career assessment: there is no graph to publish
  const now = new Date().toISOString();
  await db.from("student_skill_scores").upsert(
    graph.results.map((r) => ({ student_id: userId, skill_id: r.skillId, score: r.score, confidence: r.confidence, evidence_count: r.evidenceCount, updated_at: now })),
    { onConflict: "student_id,skill_id" }
  );
  const { error } = await db.from("career_skill_graph_snapshots").insert({
    student_id: userId, career_id: careerId, session_id: null, trigger, elo: elo.rating, readiness: graph.readiness,
    skills: graph.results.map((s) => ({ skillId: s.skillId, key: s.key, name: s.name, score: s.score, confidence: s.confidence, evidenceCount: s.evidenceCount, importance: s.importance, targetLevel: s.targetLevel })),
  });
  if (error) throw error;
  void track(db, userId, "skill_estimated", { trigger, readiness: graph.readiness });
  return { readiness: graph.readiness };
}
