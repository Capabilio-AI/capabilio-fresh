import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { buildEvidenceProfile } from "@/lib/code-dna/evidence-profile";
import { deriveCapabilityProfile, type ArenaProgrammingEvidence } from "@/lib/code-dna/capability-derivation";
import type { GithubScanResult } from "@/lib/code-dna/github-scan";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  // Both queries are user-scoped (RLS: own rows only) regardless of
  // whether a GitHub connection exists — Arena-only evidence is still
  // real Code DNA data, so it must not depend on GitHub being connected.
  const [{ data: connection }, { data: arenaAttempts }] = await Promise.all([
    supabase
      .from("github_connections")
      .select(
        "username, profile_url, verification_state, verification_code, scan_status, code_dna_score, confidence_level, repositories_analyzed, analysis, recruiter_summary, last_scanned_at, next_scan_at, last_scan_error"
      )
      .eq("user_id", auth.userId)
      .maybeSingle(),
    supabase
      .from("arena_challenge_attempts")
      .select("correct_count, answered_count, completed_at")
      .eq("user_id", auth.userId)
      .eq("section", "programming_fundamentals")
      .eq("status", "completed"),
  ]);

  const arenaProgrammingEvidence: ArenaProgrammingEvidence[] = (arenaAttempts ?? []).map((a) => ({
    correctCount: a.correct_count,
    answeredCount: a.answered_count,
    completedAt: a.completed_at as string,
  }));

  const githubScan = connection?.analysis ? (connection.analysis as unknown as GithubScanResult) : null;
  const capabilityProfile = deriveCapabilityProfile(
    githubScan,
    connection?.last_scanned_at ?? null,
    arenaProgrammingEvidence
  );

  if (!connection) {
    return NextResponse.json({ connected: false, capabilityProfile, arenaAttemptCount: arenaProgrammingEvidence.length });
  }

  const canScanNow =
    connection.verification_state === "verified" &&
    connection.scan_status !== "scanning" &&
    (!connection.next_scan_at || new Date(connection.next_scan_at) <= new Date());

  return NextResponse.json({
    connected: true,
    username: connection.username,
    profileUrl: connection.profile_url,
    verificationState: connection.verification_state,
    verificationCode: connection.verification_code,
    scanStatus: connection.scan_status,
    codeDnaScore: connection.code_dna_score,
    confidenceLevel: connection.confidence_level,
    repositoriesAnalyzed: connection.repositories_analyzed,
    recruiterSummary: connection.recruiter_summary,
    lastScannedAt: connection.last_scanned_at,
    nextScanAt: connection.next_scan_at,
    lastScanError: connection.last_scan_error,
    canScanNow,
    evidenceProfile: githubScan ? buildEvidenceProfile(githubScan) : null,
    capabilityProfile,
    arenaAttemptCount: arenaProgrammingEvidence.length,
  });
}
