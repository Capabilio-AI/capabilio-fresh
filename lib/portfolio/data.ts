import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getVaultItems, type VaultItem } from "@/lib/vault/data";
import { getViewerSummary, type ViewerSummary } from "@/lib/dashboard/viewer";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { buildCapabilityGroups, type CapabilityGroup, type PortfolioEvidence } from "@/lib/portfolio/view";
import { getPortfolioElo, type PortfolioElo } from "@/lib/portfolio/elo";

export interface ArenaTask {
  attemptId: string;
  title: string;
  company: string | null;
  area: string;
  completedAt: string | null;
}

export interface GithubEvidence {
  username: string;
  profileUrl: string;
  verified: boolean;
  repositoriesAnalyzed: number | null;
  lastScannedAt: string | null;
}

export interface InterviewSummary {
  id: string;
  mode: string;
  roleTarget: string | null;
  domain: string | null;
  questionCount: number;
  overallScore: number;
  skillScores: Record<string, number>;
  strengths: string[];
  improvements: string[];
  completedAt: string;
  durationSeconds: number;
}

export interface PortfolioData {
  viewer: ViewerSummary;
  statedRole: string | null;
  items: VaultItem[];
  groups: CapabilityGroup[];
  arenaTasks: ArenaTask[];
  github: GithubEvidence | null;
  keyEvidence: string[];
  mostRecent: string | null;
  elo: PortfolioElo;
  interviews: InterviewSummary[];
}

/**
 * All portfolio data for one user, evidence-first. Shared by the owner's
 * dashboard page (authed client) and the public share page (service client
 * + a manual `portfolio_public` gate) — same shape, same rules, only the
 * caller and the client differ.
 */
export async function getPortfolioData(supabase: SupabaseClient<Database>, userId: string): Promise<PortfolioData> {
  const [viewer, statedRole, items, evidenceResult, { data: github }, { data: completions }, elo, { data: interviewRows }] = await Promise.all([
    getViewerSummary(supabase, userId),
    getStatedCareerInterest(supabase, userId),
    getVaultItems(supabase, userId),
    supabase.from("evidence").select("skill, source_type, evidence_type, source_url, observed_at, confidence, created_at, metadata").eq("user_id", userId),
    supabase.from("github_connections").select("username, profile_url, verification_state, repositories_analyzed, last_scanned_at").eq("user_id", userId).maybeSingle(),
    supabase.from("arena_attempt_completions").select("attempt_id, skill_area_key, role_key, completed_at, challenge_id").eq("user_id", userId).order("completed_at", { ascending: false }).limit(30),
    getPortfolioElo(supabase, userId),
    supabase
      .from("ai_interview_sessions")
      .select("id, mode, role_target, domain, questions, overall_score, skill_scores, strengths, improvements, started_at, completed_at")
      .eq("user_id", userId)
      .eq("status", "completed")
      .order("completed_at", { ascending: false })
      .limit(10),
  ]);

  const evidence: PortfolioEvidence[] = (evidenceResult.data ?? []).map((r) => ({
    skill: r.skill,
    sourceType: r.source_type,
    evidenceType: r.evidence_type,
    sourceUrl: r.source_url,
    observedAt: r.observed_at,
    confidence: r.confidence,
    createdAt: r.created_at,
    metadata: r.metadata as PortfolioEvidence["metadata"],
  }));
  const groups = buildCapabilityGroups(evidence);

  const challengeIds = (completions ?? []).map((c) => c.challenge_id);
  const [{ data: challenges }, { data: areas }] = await Promise.all([
    challengeIds.length
      ? supabase.from("arena_challenges").select("id, title, content, requester").in("id", challengeIds)
      : Promise.resolve({ data: [] as { id: string; title: string; content: unknown; requester: string | null }[] }),
    supabase.from("arena_skill_areas").select("role_key, area_key, display_name"),
  ]);
  const arenaTasks: ArenaTask[] = (completions ?? []).map((c) => {
    const ch = challenges?.find((x) => x.id === c.challenge_id);
    return {
      attemptId: c.attempt_id,
      title: ch?.title ?? "Arena task",
      company: (ch?.content as { company?: string } | null)?.company ?? null,
      area: areas?.find((a) => a.role_key === c.role_key && a.area_key === c.skill_area_key)?.display_name ?? c.skill_area_key,
      completedAt: c.completed_at,
    };
  });

  const interviews: InterviewSummary[] = (interviewRows ?? [])
    .filter((r): r is typeof r & { completed_at: string; overall_score: number } => Boolean(r.completed_at) && r.overall_score !== null)
    .map((r) => ({
      id: r.id,
      mode: r.mode,
      roleTarget: r.role_target,
      domain: r.domain,
      questionCount: Array.isArray(r.questions) ? r.questions.length : 0,
      overallScore: r.overall_score,
      skillScores: (r.skill_scores as Record<string, number> | null) ?? {},
      strengths: (r.strengths as string[] | null) ?? [],
      improvements: (r.improvements as string[] | null) ?? [],
      completedAt: r.completed_at,
      durationSeconds: Math.round((Date.parse(r.completed_at) - Date.parse(r.started_at)) / 1000),
    }));

  const mostRecent = [...evidence.map((e) => e.observedAt ?? e.createdAt), ...interviews.map((i) => i.completedAt)].sort().at(-1) ?? null;
  const keyEvidence = [
    arenaTasks.length ? `${arenaTasks.length} verified Arena task${arenaTasks.length === 1 ? "" : "s"}` : null,
    interviews.length ? `${interviews.length} AI interview${interviews.length === 1 ? "" : "s"}` : null,
    github?.repositories_analyzed ? `${github.repositories_analyzed} GitHub repositories analysed` : null,
    items.length ? `${items.length} Vault item${items.length === 1 ? "" : "s"}` : null,
  ].filter((v): v is string => Boolean(v));

  return {
    viewer,
    statedRole,
    items,
    groups,
    arenaTasks,
    github: github
      ? {
          username: github.username,
          profileUrl: github.profile_url,
          verified: github.verification_state === "verified",
          repositoriesAnalyzed: github.repositories_analyzed,
          lastScannedAt: github.last_scanned_at,
        }
      : null,
    keyEvidence,
    mostRecent,
    elo,
    interviews,
  };
}
