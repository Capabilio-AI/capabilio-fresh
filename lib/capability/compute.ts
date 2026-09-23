import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database, Enums } from "@/lib/supabase/types";

type Confidence = Enums<"capability_confidence">;

// Never present a capability score as certain when it's based on 1-2 data
// points (brief's explicit requirement) — thresholds for how many answered
// questions on a skill are needed before trusting the score.
const HIGH_CONFIDENCE_MIN = 5;
const MEDIUM_CONFIDENCE_MIN = 3;

function confidenceFor(dataPoints: number): Confidence {
  if (dataPoints >= HIGH_CONFIDENCE_MIN) return "high";
  if (dataPoints >= MEDIUM_CONFIDENCE_MIN) return "medium";
  return "low";
}

interface SkillTally {
  domain: string;
  correct: number;
  total: number;
}

/**
 * Aggregates every answered question (sections 1-5 from question_bank, plus
 * career_interests from career_interest_questions) into per-skill
 * capability scores. Must run under the service-role client — capabilities
 * has no client insert/update policy by design (computed data, read-only
 * to the student).
 */
export async function computeCapabilitiesForAttempt(
  serviceClient: SupabaseClient<Database>,
  attemptId: string,
  userId: string
): Promise<{ skillsUpdated: number }> {
  const { data: responses, error: responsesError } = await serviceClient
    .from("assessment_responses")
    .select("question_id, section, is_correct")
    .eq("attempt_id", attemptId);
  if (responsesError) throw responsesError;

  const bankIds = (responses ?? [])
    .filter((r) => r.section !== "career_interests" && r.question_id)
    .map((r) => r.question_id as string);
  const { data: bankQuestions } = bankIds.length
    ? await serviceClient.from("question_bank").select("id, skill, domain").in("id", bankIds)
    : { data: [] };
  const bankById = new Map((bankQuestions ?? []).map((q) => [q.id, q]));

  const { data: interestQuestions } = await serviceClient
    .from("career_interest_questions")
    .select("id, question_index, skill_probe")
    .eq("attempt_id", attemptId);
  const interestByIndex = new Map((interestQuestions ?? []).map((q) => [q.question_index, q]));

  const { data: interestResponses } = await serviceClient
    .from("assessment_responses")
    .select("question_index, is_correct")
    .eq("attempt_id", attemptId)
    .eq("section", "career_interests");

  const tallies = new Map<string, SkillTally>();

  function tally(skill: string, domain: string, isCorrect: boolean) {
    const existing = tallies.get(skill) ?? { domain, correct: 0, total: 0 };
    existing.total += 1;
    if (isCorrect) existing.correct += 1;
    tallies.set(skill, existing);
  }

  for (const response of responses ?? []) {
    if (response.section === "career_interests" || !response.question_id) continue;
    const question = bankById.get(response.question_id);
    if (!question) continue;
    tally(question.skill, question.domain, response.is_correct);
  }

  for (const response of interestResponses ?? []) {
    const question = interestByIndex.get(response.question_index);
    if (!question) continue;
    tally(question.skill_probe, "Career Interest Signal", response.is_correct);
  }

  const rows = Array.from(tallies.entries()).map(([skill, t]) => ({
    user_id: userId,
    skill,
    domain: t.domain,
    capability_score: Math.round((t.correct / t.total) * 100),
    confidence: confidenceFor(t.total),
    data_points: t.total,
  }));

  if (rows.length === 0) return { skillsUpdated: 0 };

  const { error: upsertError } = await serviceClient
    .from("capabilities")
    .upsert(rows, { onConflict: "user_id,skill" });
  if (upsertError) throw upsertError;

  // First point on each skill's history — see lib/capability/record-evidence.ts
  // for how later evidence (projects, Arena, reassessment) appends to this.
  const { error: historyError } = await serviceClient.from("capability_history").insert(
    rows.map((r) => ({
      user_id: r.user_id,
      skill: r.skill,
      capability_score: r.capability_score,
      confidence: r.confidence,
      source: "initial_assessment" as const,
    }))
  );
  if (historyError) throw historyError;

  return { skillsUpdated: rows.length };
}
