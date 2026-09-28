import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { scanGithubProfile } from "@/lib/code-dna/github-scan";
import { scoreFingerprint } from "@/lib/code-dna/fingerprint";
import type { Json } from "@/lib/supabase/types";

const SCAN_COOLDOWN_MINUTES = 15;

/**
 * Runs a real scan + AI-scored fingerprint. Claims the row atomically
 * (scan_status: idle|failed -> scanning, only when off cooldown) so two
 * concurrent requests can't both scan the same connection — the same
 * state-machine shape as capabilio-web's Code DNA.
 */
export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "code_dna_scan", maxRequests: 6, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const service = createServiceClient();

  const { data: connection } = await service
    .from("github_connections")
    .select("username, verification_state, scan_status, next_scan_at, consecutive_failures")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: "Connect a GitHub username first." }, { status: 404 });
  }
  if (connection.verification_state !== "verified") {
    return NextResponse.json({ error: "Verify your GitHub bio before scanning." }, { status: 409 });
  }

  const nowIso = new Date().toISOString();
  const { data: claimed } = await service
    .from("github_connections")
    .update({ scan_status: "scanning" })
    .eq("user_id", auth.userId)
    .in("scan_status", ["idle", "failed"])
    .or(`next_scan_at.is.null,next_scan_at.lte.${nowIso}`)
    .select("username")
    .maybeSingle();

  if (!claimed) {
    return NextResponse.json(
      { error: "A scan is already running, or you're still on cooldown — try again shortly." },
      { status: 409 }
    );
  }

  try {
    const scan = await scanGithubProfile(connection.username);
    const fingerprint = await scoreFingerprint(scan);

    await service
      .from("github_connections")
      .update({
        scan_status: "idle",
        code_dna_score: fingerprint.score,
        confidence_level: fingerprint.confidence,
        repositories_analyzed: scan.repositoriesAnalyzed,
        analysis: scan as unknown as Json,
        recruiter_summary: fingerprint.recruiterSummary,
        last_scanned_at: new Date().toISOString(),
        next_scan_at: new Date(Date.now() + SCAN_COOLDOWN_MINUTES * 60_000).toISOString(),
        consecutive_failures: 0,
        last_scan_error: null,
      })
      .eq("user_id", auth.userId);

    return NextResponse.json({ score: fingerprint.score, summary: fingerprint.summary });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Scan failed";
    console.error("[code-dna/scan] failed:", message);
    await service
      .from("github_connections")
      .update({
        scan_status: "failed",
        last_scan_error: message,
        next_scan_at: new Date(Date.now() + SCAN_COOLDOWN_MINUTES * 60_000).toISOString(),
        consecutive_failures: connection.consecutive_failures + 1,
      })
      .eq("user_id", auth.userId);
    return NextResponse.json({ error: "Scan failed — try again in a few minutes." }, { status: 502 });
  }
}
