import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { SECTION_ORDER, type AssessmentSection } from "@/lib/assessment/sections";

const ARENA_SECTIONS = (SECTION_ORDER as AssessmentSection[]).filter((s) => s !== "career_interests");

const BodySchema = z.object({
  section: z.enum(ARENA_SECTIONS as [AssessmentSection, ...AssessmentSection[]]),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data, error } = await supabase.rpc("start_arena_challenge", {
    p_section: parsed.data.section,
    p_question_count: 10,
  });
  if (error) return NextResponse.json({ error: error.message }, { status: 400 });

  return NextResponse.json(data);
}
