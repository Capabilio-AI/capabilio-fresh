import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { listEnabledRoles, matchRoleForStatedCareer } from "@/lib/arena-workstations/taxonomy";
import { generateInterviewQuestions } from "@/lib/interview/session";

const BodySchema = z.object({ mode: z.enum(["practice", "technical", "behavioral", "hr"]) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "interview_start", maxRequests: 10, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });

  const service = createServiceClient();
  const statedRole = await getStatedCareerInterest(service, auth.userId);
  const roles = await listEnabledRoles(service);
  const matched = matchRoleForStatedCareer(roles, statedRole);

  let questions: string[];
  try {
    questions = await generateInterviewQuestions(parsed.data.mode, statedRole, matched?.parent_skill_name ?? null);
  } catch {
    return NextResponse.json({ error: "Could not start the interview — try again." }, { status: 502 });
  }

  const { data: session, error } = await service
    .from("ai_interview_sessions")
    .insert({
      user_id: auth.userId,
      mode: parsed.data.mode,
      role_target: statedRole,
      domain: matched?.parent_skill_name ?? null,
      questions,
    })
    .select("id")
    .single();
  if (error || !session) return NextResponse.json({ error: "Could not start the interview — try again." }, { status: 500 });

  return NextResponse.json({ sessionId: session.id, questions });
}
