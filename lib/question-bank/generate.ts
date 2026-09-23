import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { completeJson } from "@/lib/ai/groq";
import { QUESTIONS_PER_SECTION, type AssessmentSection } from "@/lib/assessment/sections";

// A single request for 25 questions is unreliable (see lib/assessment/
// career-interests.ts for the live-tested evidence) — generate in small
// batches, same proven pattern.
const BATCH_SIZE = 5;
const BATCH_COUNT = Math.ceil(QUESTIONS_PER_SECTION / BATCH_SIZE);

const GeneratedQuestionSchema = z.object({
  question_text: z.string().min(1),
  skill: z.string().min(1),
  capability: z.string().min(1),
  domain: z.string().min(1),
  options: z
    .array(z.object({ key: z.string().min(1), text: z.string().min(1) }))
    .min(2)
    .max(6),
  correct_option: z.string().min(1),
  difficulty: z.number().int().min(1).max(3),
});
const BatchSchema = z.object({ questions: z.array(GeneratedQuestionSchema).min(BATCH_SIZE) });

interface SectionSpec {
  label: string;
  skills: string[];
  guidance: string;
}

const SECTION_SPECS: Record<Exclude<AssessmentSection, "career_interests">, SectionSpec> = {
  technical_fundamentals: {
    label: "Technical Fundamentals",
    skills: [
      "Programming Fundamentals",
      "Data Structures",
      "Algorithms",
      "Version Control",
      "Databases",
      "Operating Systems",
    ],
    guidance: "General computer science fundamentals any engineering student should know, language-agnostic where possible.",
  },
  aptitude_reasoning: {
    label: "Aptitude / Reasoning",
    skills: ["Numerical Reasoning", "Logical Reasoning", "Verbal Reasoning", "Pattern Recognition"],
    guidance: "Standard campus-placement-style quantitative and logical aptitude questions.",
  },
  communication: {
    label: "Communication",
    skills: ["English Grammar", "Vocabulary", "Professional Writing", "Reading Comprehension"],
    guidance: "Written English and professional communication skills relevant to a workplace.",
  },
  problem_solving: {
    label: "Problem-Solving",
    skills: ["Root Cause Analysis", "Prioritization", "Structured Thinking", "Decision Making"],
    guidance: "Scenario-based questions testing analytical and structured problem-solving, not trivia.",
  },
  digital_ai_literacy: {
    label: "Digital / AI Literacy",
    skills: ["AI Fundamentals", "Prompting", "Data Privacy", "Digital Tools"],
    guidance: "Practical AI/digital literacy a student needs today — LLMs, prompting, privacy, common tools.",
  },
};

function systemPrompt(spec: SectionSpec): string {
  return `You write calibrated multiple-choice assessment questions for the "${spec.label}" section of an
Indian engineering student career assessment platform. ${spec.guidance}

Draw questions from this skill set (mix across them, one "skill" tag per question, pick whichever fits
each question best — do not invent new skill names): ${spec.skills.join(", ")}.

For each question, also tag a "capability" (the broader category this skill belongs to) and a "domain"
(one level broader still). Respond with JSON only, matching this exact shape:

{
  "questions": [
    {
      "question_text": "string",
      "skill": "string (one of the given skills)",
      "capability": "string",
      "domain": "string",
      "options": [{ "key": "A", "text": "string" }, { "key": "B", "text": "string" }, { "key": "C", "text": "string" }, { "key": "D", "text": "string" }],
      "correct_option": "A",
      "difficulty": 2
    }
  ]
}

difficulty is an integer 1 (easy) to 3 (hard). Every value in "options" must be valid JSON — no
trailing commas, no missing colons, no unescaped quotes. Avoid literal "..." ellipsis or unbalanced
parentheses inside string values. Do not repeat questions across the set.`;
}

async function generateBatch(spec: SectionSpec, alreadyAsked: string[]) {
  const avoid =
    alreadyAsked.length > 0
      ? `\n\nDo not repeat or closely rephrase any of these already-used questions:\n- ${alreadyAsked.join("\n- ")}`
      : "";
  const result = await completeJson(
    `Generate ${BATCH_SIZE} questions for the ${spec.label} section.${avoid}`,
    systemPrompt(spec),
    BatchSchema
  );
  return result.questions.slice(0, BATCH_SIZE);
}

/**
 * Backfills question_bank with a full generic (college_type/branches =
 * null — the fallback tier every student can draw from) question set for
 * one section. Callable per-section so it can be re-run to top up content
 * later without regenerating everything.
 */
export async function generateQuestionBankForSection(
  serviceClient: SupabaseClient<Database>,
  section: Exclude<AssessmentSection, "career_interests">
): Promise<{ inserted: number }> {
  const spec = SECTION_SPECS[section];
  const questions: z.infer<typeof GeneratedQuestionSchema>[] = [];
  for (let batch = 0; batch < BATCH_COUNT; batch++) {
    const generated = await generateBatch(spec, questions.map((q) => q.question_text));
    questions.push(...generated);
  }
  const rows = questions.slice(0, QUESTIONS_PER_SECTION).map((q) => ({
    section,
    skill: q.skill,
    capability: q.capability,
    domain: q.domain,
    college_type: null,
    branches: null,
    question_text: q.question_text,
    options: q.options,
    correct_option: q.correct_option,
    difficulty: q.difficulty,
    active: true,
  }));

  const { error } = await serviceClient.from("question_bank").insert(rows);
  if (error) throw error;

  return { inserted: rows.length };
}
