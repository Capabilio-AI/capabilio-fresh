import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireUser } from "@/lib/api/require-user";
import { runCode, isSupportedLanguage } from "@/lib/code-execution/wandbox";
import { SECTION_ORDER, type AssessmentSection } from "@/lib/assessment/sections";

function parseSection(raw: string): AssessmentSection | null {
  return (SECTION_ORDER as string[]).includes(raw) ? (raw as AssessmentSection) : null;
}

const BodySchema = z.object({
  questionIndex: z.number().int().min(0),
  code: z.string().min(1).max(10_000),
});

interface GradingInfo {
  language: string;
  stdin: string;
  expectedOutput: string;
}

/**
 * Grades a coding-question submission: fetches the (server-only) answer
 * key via get_coding_question_for_grading, runs the code through
 * Wandbox, compares trimmed stdout, then records the verdict via
 * record_coding_response. The expected output is never sent to the
 * client — only pass/fail plus stdout/stderr for the student to read.
 */
export async function POST(request: Request, { params }: { params: Promise<{ section: string }> }) {
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

  const { data: gradingData, error: gradingError } = await supabase.rpc("get_coding_question_for_grading", {
    p_section: section,
    p_question_index: parsed.data.questionIndex,
  });
  if (gradingError) {
    return NextResponse.json({ error: gradingError.message }, { status: 400 });
  }
  const grading = gradingData as unknown as GradingInfo;
  if (!isSupportedLanguage(grading.language)) {
    return NextResponse.json({ error: "Unsupported language" }, { status: 400 });
  }

  let stdout: string;
  let stderr: string;
  try {
    const result = await runCode(grading.language, parsed.data.code, grading.stdin ?? "");
    stdout = result.stdout;
    stderr = result.stderr || result.compileError;
  } catch {
    return NextResponse.json({ error: "Code execution service is unavailable — try again." }, { status: 502 });
  }

  const isCorrect = stdout.trim() === (grading.expectedOutput ?? "").trim();

  const { data: recordData, error: recordError } = await supabase.rpc("record_coding_response", {
    p_section: section,
    p_question_index: parsed.data.questionIndex,
    p_submitted_code: parsed.data.code,
    p_is_correct: isCorrect,
  });
  if (recordError) {
    return NextResponse.json({ error: recordError.message }, { status: 400 });
  }

  return NextResponse.json({ isCorrect, stdout, stderr, recorded: recordData });
}
