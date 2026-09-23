import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { completeJson } from "@/lib/ai/groq";
import { QUESTIONS_PER_SECTION } from "./sections";

const GeneratedQuestionSchema = z.object({
  question_text: z.string().min(1),
  options: z
    .array(z.object({ key: z.string().min(1), text: z.string().min(1) }))
    .min(2)
    .max(6),
  correct_option: z.string().min(1),
  skill_probe: z.string().min(1),
});

const TARGET_Q_COUNT = QUESTIONS_PER_SECTION.career_interests;

// A single request for TARGET_Q_COUNT (25) questions is unreliable —
// live testing against this model returned anywhere from 6 to 28 items
// across repeated attempts, never converging. Small, focused batches are
// the standard fix for reliable long-list LLM generation: each batch asks
// for far fewer items, which this model hits consistently.
const BATCH_SIZE = 5;
const BATCH_COUNT = Math.ceil(TARGET_Q_COUNT / BATCH_SIZE);

const QuestionBatchSchema = z.object({
  questions: z.array(GeneratedQuestionSchema).min(BATCH_SIZE),
});

const InterestDistributionSchema = z.object({
  interest_distribution: z.record(z.string(), z.number().min(0).max(100)),
});

function questionBatchPrompt(statedRole: string, alreadyAsked: string[]): string {
  const avoid =
    alreadyAsked.length > 0
      ? `\n\nDo not repeat or closely rephrase any of these already-used questions:\n- ${alreadyAsked.join("\n- ")}`
      : "";
  return `Career role: "${statedRole}"\n\nGenerate ${BATCH_SIZE} multiple-choice questions for this role.${avoid}`;
}

const QUESTION_SYSTEM_PROMPT = `You write calibrated multiple-choice assessment questions for an Indian engineering
student career platform. Given a career role, generate exactly the requested number of multiple-choice
questions that test a mix of role-relevant knowledge and genuine interest/fit signals (not pure trivia)
— plausible, distinct 4-option questions, one correct_option matching an option key exactly.

Respond with JSON only, matching this exact shape (field names, types, and "options" as an ARRAY of
{key, text} objects — never an object keyed by option letter):

{
  "questions": [
    {
      "question_text": "string",
      "options": [{ "key": "A", "text": "string" }, { "key": "B", "text": "string" }, { "key": "C", "text": "string" }, { "key": "D", "text": "string" }],
      "correct_option": "A",
      "skill_probe": "string naming the specific skill or trait this question probes"
    }
  ]
}

Every value in "options" must be valid JSON — no trailing commas, no missing colons, no unescaped quotes.
Avoid literal "..." ellipsis or unbalanced parentheses inside string values.`;

const DISTRIBUTION_SYSTEM_PROMPT = `Given a career role a student named, estimate a multi-role interest
distribution (0-100 each, needn't sum to 100) covering the stated role plus 3-5 adjacent roles, reflecting
how the stated interest overlaps with related careers. Respond with JSON only:
{ "interest_distribution": { "<role name>": 85 } }`;

async function generateAllQuestions(statedRole: string) {
  const questions: z.infer<typeof GeneratedQuestionSchema>[] = [];
  for (let batch = 0; batch < BATCH_COUNT; batch++) {
    const result = await completeJson(
      questionBatchPrompt(statedRole, questions.map((q) => q.question_text)),
      QUESTION_SYSTEM_PROMPT,
      QuestionBatchSchema
    );
    questions.push(...result.questions.slice(0, BATCH_SIZE));
  }
  return questions.slice(0, TARGET_Q_COUNT);
}

/**
 * Sets the student's stated Career Interests target, generates 25 MCQs
 * calibrated to it via Groq (in small batches — see generateAllQuestions),
 * and stores everything per-attempt (never shared globally — each
 * student's set is unique to their stated role).
 */
export async function generateCareerInterestSection(
  supabase: SupabaseClient<Database>,
  serviceClient: SupabaseClient<Database>,
  attemptId: string,
  userId: string,
  statedRole: string
) {
  const questions = await generateAllQuestions(statedRole);
  const { interest_distribution } = await completeJson(
    `Career role: "${statedRole}"`,
    DISTRIBUTION_SYSTEM_PROMPT,
    InterestDistributionSchema
  );

  const { error: targetError } = await supabase.from("career_interest_target").upsert({
    attempt_id: attemptId,
    user_id: userId,
    stated_role: statedRole,
  });
  if (targetError) throw targetError;

  const rows = questions.map((q, index) => ({
    attempt_id: attemptId,
    user_id: userId,
    question_index: index,
    question_text: q.question_text,
    options: q.options,
    correct_option: q.correct_option,
    skill_probe: q.skill_probe,
  }));
  const { data: inserted, error: insertError } = await supabase
    .from("career_interest_questions")
    .upsert(rows, { onConflict: "attempt_id,question_index" })
    .select("id, question_index")
    .order("question_index");
  if (insertError) throw insertError;

  const questionOrder = (inserted ?? [])
    .sort((a, b) => a.question_index - b.question_index)
    .map((row) => row.id);

  const { error: progressError } = await supabase.from("assessment_section_progress").upsert(
    {
      attempt_id: attemptId,
      user_id: userId,
      section: "career_interests",
      status: "in_progress",
      question_order: questionOrder,
      started_at: new Date().toISOString(),
    },
    { onConflict: "attempt_id,section" }
  );
  if (progressError) throw progressError;

  // interests has no client insert/update policy (computed data, read-only
  // to the student) — this write must go through the service-role client.
  const { error: interestsError } = await serviceClient.from("interests").upsert({
    user_id: userId,
    target_role: statedRole,
    distribution: interest_distribution,
  });
  if (interestsError) throw interestsError;

  return { questionCount: questionOrder.length, distribution: interest_distribution };
}
