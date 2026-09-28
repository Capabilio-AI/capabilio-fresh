import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { buildEvidenceProfile } from "@/lib/code-dna/evidence-profile";
import type { GithubScanResult } from "@/lib/code-dna/github-scan";

export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const { data: connection } = await supabase
    .from("github_connections")
    .select(
      "username, profile_url, verification_state, verification_code, scan_status, code_dna_score, confidence_level, repositories_analyzed, analysis, recruiter_summary, last_scanned_at, next_scan_at, last_scan_error"
    )
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ connected: false });
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
    evidenceProfile: connection.analysis ? buildEvidenceProfile(connection.analysis as unknown as GithubScanResult) : null,
  });
}
