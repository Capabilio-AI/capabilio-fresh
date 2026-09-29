import { z } from "zod";
import { completeJson } from "@/lib/ai/groq";

export const QUESTIONS_PER_SESSION = 6;

export const INTERVIEW_MODE_LABEL: Record<string, string> = {
  practice: "Practice",
  technical: "Technical",
  behavioral: "Behavioral",
  hr: "HR",
};

const QuestionsSchema = z.object({ questions: z.array(z.string().min(1)).length(QUESTIONS_PER_SESSION) });

const MODE_BRIEF: Record<string, string> = {
  practice: "a mixed warm-up covering a bit of everything a fresher interview might touch",
  technical: "core CS fundamentals, problem-solving, and role-specific technical depth",
  behavioral: "STAR-format questions about past projects, teamwork, and decision-making",
  hr: "culture-fit, motivation, and common HR-round questions",
};

/** One LLM call, upfront — the full question set for the session, not adaptive follow-ups (see migration note). */
export async function generateInterviewQuestions(mode: string, roleTarget: string | null, domain: string | null): Promise<string[]> {
  const brief = MODE_BRIEF[mode] ?? MODE_BRIEF.practice;
  const context = [roleTarget && `Target role: ${roleTarget}`, domain && `Domain: ${domain}`].filter(Boolean).join(". ");
  const prompt = `Generate exactly ${QUESTIONS_PER_SESSION} interview questions for a ${mode} round: ${brief}. ${context}\nQuestions should be answerable in a few sentences by a student/early-career candidate. Return JSON: {"questions": string[]}.`;
  const result = await completeJson(prompt, "You are an experienced technical interviewer designing a fair, realistic interview round for a student candidate.", QuestionsSchema);
  return result.questions;
}

const ScoreSchema = z.object({
  overallScore: z.number().min(0).max(100),
  skillScores: z.record(z.string(), z.number().min(0).max(100)),
  strengths: z.array(z.string()).max(6),
  improvements: z.array(z.string()).max(6),
});

export type InterviewScore = z.infer<typeof ScoreSchema>;

export interface TranscriptTurn {
  question: string;
  answer: string;
}

/** One LLM call at the end of the session — scores the whole transcript at once. */
export async function scoreInterviewTranscript(mode: string, roleTarget: string | null, transcript: TranscriptTurn[]): Promise<InterviewScore> {
  const qa = transcript.map((t, i) => `Q${i + 1}: ${t.question}\nA${i + 1}: ${t.answer || "(no answer given)"}`).join("\n\n");
  const prompt = `Score this ${mode} interview transcript for a candidate${roleTarget ? ` targeting ${roleTarget}` : ""}.\n\n${qa}\n\nReturn JSON: {"overallScore": 0-100, "skillScores": {"<skill name>": 0-100, ...} (2-5 skills actually evidenced by the answers), "strengths": string[] (specific, evidence-based), "improvements": string[] (specific, actionable)}.`;
  return completeJson(prompt, "You are a fair, evidence-based interview assessor. Score only what the answers actually demonstrate — do not inflate scores for vague or missing answers.", ScoreSchema);
}
