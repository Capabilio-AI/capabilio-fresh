import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { recordResponse, InvalidResponseError } from "@/lib/assessment/responses";
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

  const section = parseSection((await params).section);
  if (!section) {
    return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  }

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
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
    const result = await recordResponse(
      supabase,
      attempt.id,
      auth.userId,
      section,
      parsed.data.questionIndex,
      parsed.data.selectedOption
    );
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof InvalidResponseError) {
      return NextResponse.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }
}
