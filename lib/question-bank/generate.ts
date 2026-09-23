import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { completeJson } from "@/lib/ai/groq";
import { QUESTIONS_PER_SECTION, type AssessmentSection } from "@/lib/assessment/sections";

// A single request for a full section's worth of questions is unreliable
// (see lib/assessment/career-interests.ts for the live-tested evidence) —
// generate in small batches, same proven pattern.
const BATCH_SIZE = 5;

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

// Tuned for a 1st-year (1-2 semester) B.Tech student — every section stays
// at foundational, campus-placement-prep difficulty, not final-year level.
const SECTION_SPECS: Record<Exclude<AssessmentSection, "career_interests">, SectionSpec> = {
  quantitative_aptitude: {
    label: "Quantitative Aptitude",
    skills: [
      "Percentages",
      "Profit & Loss",
      "Ratios & Averages",
      "Time & Work",
      "Time-Speed-Distance",
      "Number Systems",
      "Simplification & Basic Algebra",
      "Probability & Permutations-Combinations (basic)",
    ],
    guidance:
      "Standard campus-placement-test quantitative aptitude for a 1st-year B.Tech student (1-2 semester). Moderate difficulty, solvable in under a minute without a calculator.",
  },
  logical_reasoning: {
    label: "Logical & Analytical Reasoning",
    skills: [
      "Number & Alphabet Series",
      "Coding-Decoding",
      "Blood Relations",
      "Directions",
      "Basic Seating Arrangement",
      "Syllogisms",
      "Statements & Conclusions",
      "Basic Puzzles",
    ],
    guidance:
      "Standard campus-placement-test logical and analytical reasoning for a 1st-year B.Tech student. Entry-level difficulty — introductory puzzles and deductions, not multi-constraint arrangements.",
  },
  verbal_communication: {
    label: "Verbal Ability & Communication",
    skills: [
      "Reading Comprehension",
      "Grammar (error spotting, sentence correction, tenses, subject-verb agreement)",
      "Vocabulary in Context (synonyms/antonyms, fill-in-the-blanks)",
      "Basic Business/Technical Communication Sense",
    ],
    guidance:
      "English proficiency needed for interviews, group discussions, emails, and documentation. Pitched at a 1st-year B.Tech student's level — clear, everyday professional English, not advanced literary vocabulary.",
  },
  programming_fundamentals: {
    label: "Basic Programming & Computational Thinking",
    skills: [
      "Variables, Data Types, Operators",
      "If-Else & Loops",
      "Arrays (conceptual + code tracing)",
      "Functions & Basic I/O",
      "Simple String/Array Operations",
      "Debugging (find the error / predict the output)",
    ],
    guidance:
      "Checks how well a 1st-year student has picked up their intro C/Python course, regardless of branch. Write each question as a short C or Python code snippet (state the language) followed by a 'predict the output' or 'find the bug' question — no live code execution is available, so every question must be answerable purely by reading the snippet. Keep snippets under 8 lines. Only very easy constructs: variables, if-else, loops, arrays, functions, basic string/array ops.",
  },
  engineering_mathematics: {
    label: "Engineering Mathematics Fundamentals",
    skills: [
      "Limits & Differentiation",
      "Basic Integration",
      "Matrices & Determinants (rank, inverse, linear equations)",
      "Ordinary Differential Equations (basic forms)",
      "Coordinate Geometry / Vectors (basic)",
    ],
    guidance:
      "1st-year (1-1/1-2 semester) engineering mathematics syllabus. Every question must be answerable as multiple choice — phrase numerical problems as 'what is the value of X' with four numeric options, not as a free-response numeric-entry question. No lengthy derivations; focus on direct application of a single concept, solvable in under two minutes.",
  },
  basic_sciences: {
    label: "Basic Sciences & Engineering Awareness",
    skills: [
      "Engineering Physics (mechanics, waves, optics, basic modern physics)",
      "Engineering Chemistry (bonding, electrochemistry, water chemistry, polymers, corrosion)",
      "Basic Electrical Concepts (Ohm's law, simple circuits)",
      "Units, Dimensions & Measurement Errors",
      "General Engineering Awareness (what each branch broadly covers)",
    ],
    guidance:
      "1st-year engineering physics and chemistry plus light, branch-agnostic engineering awareness. Conceptual understanding only, at the depth taught in a common 1st-year syllabus — not branch-specialized content.",
  },
};

function systemPrompt(spec: SectionSpec): string {
  return `You write calibrated multiple-choice assessment questions for the "${spec.label}" section of a
career assessment platform aimed at 1st-year (1-2 semester) Indian B.Tech engineering students. ${spec.guidance}

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

difficulty is an integer 1 (easy) to 3 (hard) — for this audience, difficulty 3 still means "solid
1st-year foundational", never final-year or competitive-exam-advanced. Every value in "options" must be
valid JSON — no trailing commas, no missing colons, no unescaped quotes. Avoid literal "..." ellipsis or
unbalanced parentheses inside string values. Do not repeat questions across the set.`;
}

async function generateBatch(spec: SectionSpec, batchSize: number, alreadyAsked: string[]) {
  const avoid =
    alreadyAsked.length > 0
      ? `\n\nDo not repeat or closely rephrase any of these already-used questions:\n- ${alreadyAsked.join("\n- ")}`
      : "";
  const result = await completeJson(
    `Generate ${batchSize} questions for the ${spec.label} section.${avoid}`,
    systemPrompt(spec),
    BatchSchema
  );
  return result.questions.slice(0, batchSize);
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
  const target = QUESTIONS_PER_SECTION[section];
  const questions: z.infer<typeof GeneratedQuestionSchema>[] = [];
  while (questions.length < target) {
    const batchSize = Math.min(BATCH_SIZE, target - questions.length);
    const generated = await generateBatch(
      spec,
      batchSize,
      questions.map((q) => q.question_text)
    );
    questions.push(...generated);
  }
  const rows = questions.slice(0, target).map((q) => ({
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
