import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { submitSection, SectionIncompleteError } from "@/lib/assessment/submit";
import { computeCapabilitiesForAttempt } from "@/lib/capability/compute";
import { seedArenaRatingFromAssessment } from "@/lib/capability/seed-arena-rating";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { SECTION_ORDER, type AssessmentSection } from "@/lib/assessment/sections";

function parseSection(raw: string): AssessmentSection | null {
  return (SECTION_ORDER as string[]).includes(raw) ? (raw as AssessmentSection) : null;
}

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ section: string }> }
) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "assessment_submit", maxRequests: 30, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const section = parseSection((await params).section);
  if (!section) {
    return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  }

  const { data: attempt } = await supabase
    .from("assessment_attempts")
    .select("id")
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!attempt) {
    return NextResponse.json({ error: "Assessment not started" }, { status: 404 });
  }

  try {
    const result = await submitSection(supabase, attempt.id, auth.userId, section);
    if (result.attemptCompleted) {
      // All 6 sections done — this is the hand-off point to Phase 3
      // (capability scoring, then career matching / Guide Path). Capability
      // writes need the service-role client (no client insert/update policy).
      const service = createServiceClient();
      await computeCapabilitiesForAttempt(service, attempt.id, auth.userId);
      const statedRole = await getStatedCareerInterest(service, auth.userId);
      await seedArenaRatingFromAssessment(service, auth.userId, statedRole);
    }
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof SectionIncompleteError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
