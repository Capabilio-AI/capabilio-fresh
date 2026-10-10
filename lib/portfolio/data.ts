import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { getVaultItems, type VaultItem } from "@/lib/vault/data";
import { getViewerSummary, type ViewerSummary } from "@/lib/dashboard/viewer";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { buildCapabilityGroups, type CapabilityGroup, type PortfolioEvidence } from "@/lib/portfolio/view";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { getEducationEntries, type EducationEntry } from "@/lib/dashboard/education";
import { getPortfolioElo, type PortfolioElo } from "@/lib/portfolio/elo";

export interface ArenaTask {
  attemptId: string;
  title: string;
  company: string | null;
  area: string;
  completedAt: string | null;
  /** Catalog Domain tickets carry their score and ELO; legacy workstation tasks do not. */
  score?: number;
  eloDelta?: number;
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

export interface PortfolioProfile {
  headline: string | null;
  bio: string | null;
  location: string | null;
  /** null on a public view unless the student switched contact sharing on: it never reaches the browser otherwise. */
  contact: { email: string; phone: string | null } | null;
  /** The student's own switch, so the owner can see what recruiters will see. */
  contactShared: boolean;
}

export interface PortfolioData {
  profile: PortfolioProfile;
  education: EducationEntry[];
  viewer: ViewerSummary;
  statedRole: string | null;
  items: VaultItem[];
  groups: CapabilityGroup[];
  arenaTasks: ArenaTask[];
  github: GithubEvidence | null;
  keyEvidence: string[];
  mostRecent: string | null;
  elo: PortfolioElo;
  /** From the latest skill-graph snapshot on the student's primary career; null until they have one. */
  graph: { careerName: string | null; readiness: number; skills: { name: string; score: number; evidenceCount: number; targetLevel: number | null }[] } | null;
  interviews: InterviewSummary[];
}

/**
 * All portfolio data for one user, evidence-first. Shared by the owner's
 * dashboard page (authed client) and the public share page (service client
 * + a manual `portfolio_public` gate) — same shape, same rules, only the
 * caller and the client differ.
 */
export async function getPortfolioData(supabase: SupabaseClient<Database>, userId: string, opts: { publicView?: boolean } = {}): Promise<PortfolioData> {
  const [viewerRaw, statedRole, items, evidenceResult, { data: github }, { data: completions }, elo, { data: interviewRows }, education, { data: details }] = await Promise.all([
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
    getEducationEntries(supabase, userId),
    supabase.from("profiles").select("headline, bio, location, phone, portfolio_show_contact").eq("id", userId).maybeSingle(),
  ]);
  const contactShared = details?.portfolio_show_contact ?? false;
  const showContact = !opts.publicView || contactShared;
  const viewer = showContact ? viewerRaw : { ...viewerRaw, email: "" };
  const profile: PortfolioProfile = {
    headline: details?.headline ?? null,
    bio: details?.bio ?? null,
    location: details?.location ?? null,
    contact: showContact && viewerRaw.email ? { email: viewerRaw.email, phone: details?.phone ?? null } : null,
    contactShared,
  };

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

  // Domain tickets from the catalog model (challenge_attempts) are verified Arena work too. The caller has already authorised `userId`, so this reads with the service client.
  const { data: ticketRows } = await untyped(createServiceClient())
    .from("challenge_attempts")
    .select("id, submitted_at, score, elo_delta, arena_challenges ( title, track ), challenge_id")
    .eq("student_id", userId)
    .eq("status", "PASSED")
    .eq("evidence_status", "VERIFIED_AUTOMATED")
    .order("submitted_at", { ascending: false })
    .limit(30);
  const ticketTasks: ArenaTask[] = ((ticketRows ?? []) as unknown as { id: string; submitted_at: string; score: number | null; elo_delta: number | null; arena_challenges: { title: string; track: string } | null }[])
    .filter((t) => t.arena_challenges?.track === "domain")
    .map((t) => ({ attemptId: t.id, title: t.arena_challenges!.title, company: null, area: "Domain ticket", completedAt: t.submitted_at, score: t.score ?? 0, eloDelta: t.elo_delta ?? 0 }));
  arenaTasks.push(...ticketTasks);
  arenaTasks.sort((a, b) => ((a.completedAt ?? "") < (b.completedAt ?? "") ? 1 : -1));

  const graph = await loadGraph(userId);

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
    profile,
    education,
    viewer,
    statedRole,
    items,
    groups,
    arenaTasks,
    graph,
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

/** The measured skill scores and readiness behind the portfolio, from the newest snapshot of the primary career. Service client: the caller already authorised `userId`. */
async function loadGraph(userId: string): Promise<PortfolioData["graph"]> {
  const db = untyped(createServiceClient());
  const { data: intent } = await db.from("student_career_intent").select("primary_career_id").eq("student_id", userId).maybeSingle();
  const careerId = (intent as { primary_career_id: string | null } | null)?.primary_career_id;
  if (!careerId) return null;
  const [{ data: snap }, { data: career }] = await Promise.all([
    db.from("career_skill_graph_snapshots").select("readiness, skills").eq("student_id", userId).eq("career_id", careerId).order("created_at", { ascending: false }).limit(1).maybeSingle(),
    db.from("careers").select("name").eq("id", careerId).maybeSingle(),
  ]);
  if (!snap) return null;
  const skills = ((snap as { skills: { name: string; score: number; evidenceCount: number; targetLevel?: number | null }[] }).skills ?? []).map((k) => ({ name: k.name, score: Math.round(k.score), evidenceCount: k.evidenceCount, targetLevel: typeof k.targetLevel === "number" ? Math.round(k.targetLevel) : null }));
  return { careerName: (career as { name: string } | null)?.name ?? null, readiness: Math.round((snap as { readiness: number }).readiness), skills };
}
