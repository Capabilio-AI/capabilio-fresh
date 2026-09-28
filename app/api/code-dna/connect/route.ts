import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { fetchGithubProfile, normalizeGithubUsername } from "@/lib/code-dna/github-scan";
import { generateVerificationCode } from "@/lib/code-dna/verification";

const BodySchema = z.object({
  username: z.string().trim().regex(/^[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,37}[a-zA-Z0-9])?$/, "Not a valid GitHub username"),
});

/** Starts (or restarts) ownership verification for a GitHub username — does not scan yet. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "code_dna_connect", maxRequests: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const body = await request.json();
  const parsed = BodySchema.safeParse({
    ...body,
    username: typeof body.username === "string" ? normalizeGithubUsername(body.username) : body.username,
  });
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const profile = await fetchGithubProfile(parsed.data.username);
  if (!profile) {
    return NextResponse.json({ error: "That GitHub username doesn't exist or isn't public." }, { status: 404 });
  }

  const verificationCode = generateVerificationCode();
  const service = createServiceClient();
  const { error } = await service.from("github_connections").upsert(
    {
      user_id: auth.userId,
      username: profile.login,
      profile_url: profile.htmlUrl,
      verification_state: "pending",
      verification_code: verificationCode,
      scan_status: "idle",
    },
    { onConflict: "user_id" }
  );
  if (error) throw error;

  return NextResponse.json({ username: profile.login, profileUrl: profile.htmlUrl, verificationCode });
}
