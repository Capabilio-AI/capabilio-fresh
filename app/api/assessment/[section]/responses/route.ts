import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { rejectSectionOutsideMode } from "@/lib/assessment/guard";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import {
  recordResponse,
  InvalidResponseError,
  AssessmentNotStartedError,
} from "@/lib/assessment/responses";
import { SECTION_ORDER, type AssessmentSection } from "@/lib/assessment/sections";

function parseSection(raw: string): AssessmentSection | null {
  return (SECTION_ORDER as string[]).includes(raw) ? (raw as AssessmentSection) : null;
}

const BodySchema = z.object({
  questionIndex: z.number().int().min(0),
  selectedOption: z.string().min(1),
});

export async function POST(
  request: Request,
  { params }: { params: Promise<{ section: string }> }
) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const rateLimit = await checkRateLimit(auth.userId, { bucket: "assessment_responses", maxRequests: 120, windowSeconds: 60 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);

  const section = parseSection((await params).section);
  if (!section) {
    return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  }

  const outsideMode = await rejectSectionOutsideMode(supabase, auth.userId, section);
  if (outsideMode) return outsideMode;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  try {
    const result = await recordResponse(
      supabase,
      section,
      parsed.data.questionIndex,
      parsed.data.selectedOption
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof AssessmentNotStartedError) {
      return NextResponse.json({ error: error.message }, { status: 404 });
    }
    if (error instanceof InvalidResponseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
