// THE source of truth for what a student's numbers are. The result popup, the dashboard ELO card, the Skills section and the Skill
// Graph tab all render this one object (through GET /api/students/me/career-profile and the useCareerProfile hook), so they cannot
// disagree: ELO, readiness and every skill come from the same latest snapshot, never from separate calculations.

import { loadCareerSkills, getOnboardingStatus, dashboardUnlocked, type Db } from "./db";
import type { OnboardingStatus } from "./config";
import { computeReadiness, type SectionBar, type SkillResult } from "./scoring";
import type { AssessmentResult } from "./types";

export interface EloPoint {
  at: string;
  source: "ASSESSMENT" | "ARENA";
  change: number;
  newRating: number;
}
export interface CareerProfile {
  status: OnboardingStatus;
  /** false until PROFILE_READY: no numbers are exposed before then (never a placeholder score) */
  unlocked: boolean;
  role: { id: string; key: string; name: string } | null;
  elo: { rating: number; fromAssessment: number; fromArena: number; events: number; history: EloPoint[] } | null;
  readiness: number | null;
  coverage: number | null;
  skills: SkillResult[];
  common: SectionBar[] | null;
  snapshotId: string | null;
  updatedAt: string | null;
}

/** The rating any surface shows: the shared profile once loaded, else the figure the server returned with the same snapshot. */
export const displayRating = (profile: CareerProfile | null, fallback: number) => profile?.elo?.rating ?? fallback;

const EMPTY = (status: OnboardingStatus, unlocked = false): CareerProfile => ({ status, unlocked, role: null, elo: null, readiness: null, coverage: null, skills: [], common: null, snapshotId: null, updatedAt: null });

export async function getCareerProfile(db: Db, userId: string): Promise<CareerProfile> {
  const status = await getOnboardingStatus(db, userId);
  if (!dashboardUnlocked(status)) return EMPTY(status);

  const { data: intent } = await db.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle();
  const careerId = intent?.primary_career_id as string | undefined;
  if (!careerId) return EMPTY(status, true);

  const [{ data: career }, { data: snap }, { data: events }, { data: common }, taxonomy] = await Promise.all([
    db.from("careers").select("id, key, name").eq("id", careerId).maybeSingle(),
    db.from("career_skill_graph_snapshots").select("id, elo, readiness, skills, created_at").eq("student_id", userId).eq("career_id", careerId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("elo_events").select("created_at, source, change, new_rating").eq("student_id", userId).eq("career_id", careerId).order("created_at", { ascending: true }).limit(500),
    db.from("assess_sessions").select("result").eq("student_id", userId).eq("layer", "GENERAL").eq("status", "COMPLETED").order("completed_at", { ascending: false }).limit(1).maybeSingle(),
    loadCareerSkills(db, careerId),
  ]);
  if (!career || !snap) return { ...EMPTY(status, true), role: career ?? null };

  const meta = new Map(taxonomy.map((t) => [t.skillId, t]));
  type Stored = { skillId: string; score: number | null; confidence: SkillResult["confidence"]; evidenceCount: number };
  const skills: SkillResult[] = (snap.skills as Stored[]).flatMap((s) => {
    const t = meta.get(s.skillId);
    return t ? [{ skillId: s.skillId, key: t.key, name: t.name, category: t.category, importance: t.importance, targetLevel: t.targetLevel, weight: t.weight, score: s.score, confidence: s.confidence, evidenceCount: s.evidenceCount }] : [];
  });
  const history: EloPoint[] = (events ?? []).map((e: { created_at: string; source: EloPoint["source"]; change: number; new_rating: number }) => ({ at: e.created_at, source: e.source, change: e.change, newRating: e.new_rating }));
  return {
    status, unlocked: true, role: career,
    elo: {
      rating: snap.elo, events: history.length,
      fromAssessment: history.filter((h) => h.source === "ASSESSMENT").reduce((a, h) => a + h.change, 0),
      fromArena: history.filter((h) => h.source === "ARENA").reduce((a, h) => a + h.change, 0),
      history: history.slice(-60),
    },
    readiness: snap.readiness,
    coverage: computeReadiness(skills).coverage,
    skills,
    common: ((common?.result as AssessmentResult | undefined)?.general) ?? null,
    snapshotId: snap.id,
    updatedAt: snap.created_at,
  };
}
