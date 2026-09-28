import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { bioContainsCode } from "@/lib/code-dna/github-scan";

/** Checks the student's public GitHub bio for their verification code. On success, marks the connection verified (a scan still needs a separate POST /api/code-dna/scan). */
export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "code_dna_verify", maxRequests: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const service = createServiceClient();
  const { data: connection } = await service
    .from("github_connections")
    .select("username, verification_code")
    .eq("user_id", auth.userId)
    .maybeSingle();

  if (!connection) {
    return NextResponse.json({ error: "Connect a GitHub username first." }, { status: 404 });
  }

  const verified = await bioContainsCode(connection.username, connection.verification_code);
  if (!verified) {
    return NextResponse.json(
      { verified: false, error: "We couldn't find your verification code in your GitHub bio yet." },
      { status: 200 }
    );
  }

  const { error } = await service
    .from("github_connections")
    .update({ verification_state: "verified" })
    .eq("user_id", auth.userId);
  if (error) throw error;

  return NextResponse.json({ verified: true });
}
