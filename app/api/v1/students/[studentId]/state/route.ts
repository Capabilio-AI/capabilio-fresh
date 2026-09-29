import { NextResponse } from "next/server";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { can } from "@/lib/auth/authorize";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { getSkills } from "@/lib/dashboard/data";
import { matchCareersForStudent } from "@/lib/career/match";
import { computeNextAction } from "@/lib/dashboard/next-action";
import { JOURNEY_STAGES, currentStageIndex } from "@/lib/journey/stage";

/**
 * Self-access is always allowed. Cross-student access requires the viewer
 * to hold a role granting "person: read" (or better) within the SAME
 * institution as the target student — driven by the roles/role_permissions
 * tables (lib/auth/authorize.ts), not a hardcoded role list. Enforced here
 * in application code, in addition to each underlying table's own RLS —
 * per docs/platform-evolution/03-authorization-matrix.md.
 */
async function canAccessStudent(
  supabase: SupabaseClient<Database>,
  viewerId: string,
  studentId: string
): Promise<boolean> {
  if (viewerId === studentId) return true;

  const { data: studentMembership } = await supabase
    .from("institution_memberships")
    .select("institution_id")
    .eq("user_id", studentId)
    .maybeSingle();
  if (!studentMembership) return false;

  return can(supabase, viewerId, "person", "read", {
    organisationId: studentMembership.institution_id,
  });
}

function aggregateCapabilityDimensions(skills: Awaited<ReturnType<typeof getSkills>>) {
  const byDomain = new Map<string, { total: number; count: number }>();
  for (const s of skills) {
    if (s.domain === "Career Interest Signal") continue;
    const bucket = byDomain.get(s.domain) ?? { total: 0, count: 0 };
    bucket.total += s.score;
    bucket.count += 1;
    byDomain.set(s.domain, bucket);
  }
  const dimensions = [...byDomain.entries()].map(([domain, { total, count }]) => ({
    domain,
    score: Math.round(total / count),
  }));
  const overall =
    dimensions.length > 0
      ? Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length)
      : null;
  return { overall, dimensions };
}

export async function GET(
  request: Request,
  { params }: { params: Promise<{ studentId: string }> }
) {
  const { studentId } = await params;
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const allowed = await canAccessStudent(supabase, auth.userId, studentId);
  if (!allowed) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const [viewer, skills, careerMatches, { data: recentEvidenceRows }] = await Promise.all([
    getViewerSummary(supabase, studentId),
    getSkills(supabase, studentId),
    matchCareersForStudent(supabase, studentId),
    supabase
      .from("capability_history")
      .select("skill, capability_score, source, recorded_at")
      .eq("user_id", studentId)
      .order("recorded_at", { ascending: false })
      .limit(10),
  ]);

  const topMatch = careerMatches[0] ?? null;
  const nextAction = computeNextAction(topMatch);
  const { overall, dimensions } = aggregateCapabilityDimensions(skills);
  const academicPhaseIndex = currentStageIndex(viewer.direction?.academicYear?.year ?? null);

  return NextResponse.json({
    studentId,
    academicContext: {
      institutionName: viewer.collegeName,
      branch: viewer.branch,
      academicYear: viewer.direction?.academicYear?.year ?? null,
      startYear: viewer.direction?.startYear ?? null,
      endYear: viewer.direction?.endYear ?? null,
    },
    capabilityState: {
      overall,
      dimensions,
    },
    careerState: topMatch
      ? {
          topCareer: topMatch.careerRole,
          readiness: topMatch.overallReadiness,
          recommendation: topMatch.recommendation,
        }
      : { topCareer: null, readiness: null, recommendation: null },
    journeyState: {
      // Year-derived until docs/architecture/02-journey-engine.md's split
      // lands (student_journeys.current_capability_phase /
      // current_career_phase, computed independently of academic year).
      academicPhaseIndex,
      academicPhaseLabel: JOURNEY_STAGES[academicPhaseIndex].label,
    },
    currentFocus: nextAction?.skill ?? null,
    nextBestAction: nextAction,
    skillGaps:
      topMatch?.skillGaps.map((g) => ({
        skill: g.skill,
        current: g.current,
        required: g.required,
        gap: g.gap,
      })) ?? [],
    recentEvidence: (recentEvidenceRows ?? []).map((row) => ({
      skill: row.skill,
      score: row.capability_score,
      source: row.source,
      recordedAt: row.recorded_at,
    })),
    readiness: topMatch?.overallReadiness ?? null,
  });
}
