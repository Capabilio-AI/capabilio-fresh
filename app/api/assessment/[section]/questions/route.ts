import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { getSectionQuestions } from "@/lib/assessment/questions";
import { SECTION_ORDER, type AssessmentSection } from "@/lib/assessment/sections";

function parseSection(raw: string): AssessmentSection | null {
  return (SECTION_ORDER as string[]).includes(raw) ? (raw as AssessmentSection) : null;
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ section: string }> }
) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const section = parseSection((await params).section);
  if (!section) {
    return NextResponse.json({ error: "Unknown section" }, { status: 404 });
  }

  if (section === "career_interests") {
    // This path still queries by attempt_id directly (not the RPC used
    // below, which derives everything from auth.uid()) since career
    // interest questions live in their own per-attempt table.
    const { data: attempt } = await supabase
      .from("assessment_attempts")
      .select("id")
      .eq("user_id", auth.userId)
      .maybeSingle();
    if (!attempt) {
      return NextResponse.json({ error: "Assessment not started" }, { status: 404 });
    }

    // Career Interests questions are generated on demand via
    // POST /api/assessment/career-interests, not selected from question_bank.
    const { data: progress } = await supabase
      .from("assessment_section_progress")
      .select("status")
      .eq("attempt_id", attempt.id)
      .eq("section", section)
      .maybeSingle();

    if (!progress) {
      return NextResponse.json({ status: "needs_target_role" });
    }

    const [{ data: questions }, { data: responses }] = await Promise.all([
      supabase
        .from("career_interest_questions")
        .select("question_index, question_text, options, correct_option")
        .eq("attempt_id", attempt.id)
        .order("question_index"),
      supabase
        .from("assessment_responses")
        .select("question_index, selected_option")
        .eq("attempt_id", attempt.id)
        .eq("section", section),
    ]);
    const answeredByIndex = new Map(
      responses?.map((r) => [r.question_index, r.selected_option]) ?? []
    );

    return NextResponse.json({
      section,
      status: progress.status,
      questions: (questions ?? []).map((q) => {
        const answeredOption = answeredByIndex.get(q.question_index) ?? null;
        return {
          index: q.question_index,
          questionText: q.question_text,
          options: q.options,
          answeredOption,
          // Same answer-key protection as the bank-backed RPC: only
          // reveal correct_option for a question already answered.
          correctOption: answeredOption !== null ? q.correct_option : null,
        };
      }),
    });
  }

  try {
    const result = await getSectionQuestions(supabase, section);
    return NextResponse.json(result);
  } catch (error) {
    if (error instanceof Error && error.message.includes("Assessment not started")) {
      return NextResponse.json({ error: "Assessment not started" }, { status: 404 });
    }
    throw error;
  }
}
