// Versioned prompt for question generation. Bump PROMPT_VERSION when the wording changes materially: it is stored with every question
// so a bad batch can be traced to the prompt that made it. Nothing provider-specific belongs here.
import type { Difficulty } from "@/lib/assess/config";
import { QUESTION_TYPES } from "@/lib/assess/config";
import type { Slot } from "@/lib/assess/slots";
import type { Expectation } from "@/lib/assess/validate";

export const QUESTION_PROMPT_VERSION = "question.v4";

// The general (common) assessment stays beginner level at every difficulty.
const DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  EASY: "a first-year student who has just heard of this skill should get it right: a basic term, what it is for, or the simplest example",
  MEDIUM: "applies one basic idea to a short, simple everyday situation; no jargon beyond the skill's own basic vocabulary",
  HARD: "still beginner level: combines two basic ideas or reads a tiny example (2-4 lines of code, a 3-row table); never edge cases, tooling or production trade-offs",
};

// Career questions are an ENTRY-LEVEL (fresher) assessment: students and fresh graduates who have never worked in the role. The three levels
// climb from first-year fundamentals to the top of what a fresher is expected to handle; none of them asks for professional depth.
const CAREER_DIFFICULTY_GUIDE: Record<Difficulty, string> = {
  EASY: "first-year fundamentals: a student who has just heard of this skill should get it right: a basic term, what it is for, or the simplest example",
  MEDIUM: "what a fresher is expected to know in an entry-level screening: applies one core idea of the skill to a short, realistic situation, using the skill's common vocabulary but no deep tooling",
  HARD: "the upper end of entry-level: combines two core ideas or reads a short example (up to about 6 lines of code, or a small table); a strong fresher should manage it. Never architecture, production trade-offs or judgement that needs years of experience",
};

export interface PromptContext {
  slot: Slot;
  difficulty: Difficulty;
  count: number;
  studentLevel: string;
  /** stems already in the pool / this student's history, so Groq does not repeat them */
  avoid: string[];
  /** skills already assessed and still to come (context only; helps Groq keep the set varied) */
  assessed?: string[];
  remaining?: string[];
}

const SHAPE = `{
  "questions": [
    {
      "question": "string (the full question, including any table, query or code snippet it refers to)",
      "options": ["string", "string", "string", "string"],
      "skill": "string",
      "skillId": "string (exactly the SKILL_ID given)",
      "careerRole": "string (the career role given)",
      "difficulty": "EASY | MEDIUM | HARD (exactly the DIFFICULTY given)",
      "type": "${QUESTION_TYPES.join(" | ")}",
      "correctAnswer": "string (must be identical to one of the options)",
      "explanation": "string (why the correct answer is right and what the most tempting wrong one gets wrong)",
      "estimatedTimeSeconds": 60
    }
  ]
}`;

export function buildPrompt(c: PromptContext): { system: string; user: string; expectation: Expectation } {
  const common = `You write multiple-choice questions for a career-readiness assessment used by engineering students and freshers in India.
Rules:
- Exactly 4 options, one unambiguously correct, plausible distractors that reflect real misconceptions. No "all/none of the above", no option letters inside options.
- The correct answer must be verifiable from the question alone; if it depends on data or code, include that data or code in the question.
- Never reveal the answer in the stem. Vary which option is correct.
- Options are shuffled before a student sees them: NEVER refer to an option by number or letter ("Option 2", "choice B") in the question or the explanation; describe the option's content instead.
- If a question says a query/code "fails", it must fail on every mainstream engine, not only some; avoid dialect-specific behaviour.
- Respond with ONE JSON object, no prose, no code fences, matching exactly:
${SHAPE}`;

  if (c.slot.kind === "CAREER") {
    const s = c.slot;
    const system = `${common}
- These are ENTRY-LEVEL (fresher) questions about the role "${s.careerName}" for engineering students and fresh graduates about to start in this role. Nobody has job experience. They check whether the candidate has the foundations of "${s.skillName}" that a fresher is expected to bring, at the DIFFICULTY given, not whether they could already do the job.
  Use plain words. Prefer short, concrete questions: what a term means, what something is used for, which of four examples is correct, or what a short snippet prints. A short realistic scenario is welcome. Do NOT write tricky, expert or tool-specific questions, and do not assume prior work experience.
  Example of the right style (EASY): "Which of these is used to find the average of a column of numbers in SQL?" with four short options.
- Pick the "type" that fits the question: ${QUESTION_TYPES.join(", ")}.`;
    const user = [
      `CAREER_ROLE: ${s.careerName}`,
      `SKILL_ID: ${s.skillKey}`,
      `SKILL: ${s.skillName}${s.skillDescription ? ` — ${s.skillDescription}` : ""}`,
      `DIFFICULTY: ${c.difficulty} (${CAREER_DIFFICULTY_GUIDE[c.difficulty]})`,
      `STUDENT_LEVEL: ${c.studentLevel}`,
      c.assessed?.length ? `ALREADY_ASSESSED_SKILLS: ${c.assessed.join(", ")}` : "",
      c.remaining?.length ? `STILL_TO_ASSESS: ${c.remaining.join(", ")}` : "",
      c.avoid.length ? `Do not repeat or lightly reword any of these existing questions:\n- ${c.avoid.join("\n- ")}` : "",
      `Write ${c.count} different questions that all test ${s.skillName} for a ${s.careerName}, each on a different point.`,
    ].filter(Boolean).join("\n");
    return { system, user, expectation: { skillKey: s.skillKey, careerKey: s.careerKey, careerName: s.careerName, difficulty: c.difficulty, minQuestionLength: 25 } };
  }

  const g = c.slot;
  const system = `${common}
- This is the GENERAL diagnostic section "${g.label}". It is never career specific. ${g.guidance}
- Set "careerRole" to "General" and "skillId" to the SECTION_ID. Set "skill" to the single sub-skill the question tests, chosen from: ${g.skills.join("; ")}.
- Pick the "type" that fits: ${QUESTION_TYPES.join(", ")}.`;
  const user = [
    `SECTION_ID: ${g.section}`,
    `DIFFICULTY: ${c.difficulty} (${DIFFICULTY_GUIDE[c.difficulty]})`,
    `STUDENT_LEVEL: ${c.studentLevel}`,
    c.avoid.length ? `Do not repeat or lightly reword any of these existing questions:\n- ${c.avoid.join("\n- ")}` : "",
    `Write ${c.count} different questions for this section, spread across its sub-skills.`,
  ].filter(Boolean).join("\n");
  return { system, user, expectation: { skillKey: g.section, careerKey: null, difficulty: c.difficulty, minQuestionLength: 25 } };
}

