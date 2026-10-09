import { z } from "zod";

// Versioned prompt for the encouraging feedback shown after the assessment. The model only ever sees computed facts and must not
// invent numbers; the numbers on screen always come from the deterministic result, never from this text.
export const FEEDBACK_PROMPT_VERSION = "feedback.v1";

export const FeedbackSchema = z.object({
  summary: z.string().trim().min(20).max(400),
  strengths: z.array(z.string().trim().min(3).max(160)).min(1).max(3),
  focusAreas: z.array(z.string().trim().min(3).max(160)).min(1).max(3),
  nextStep: z.string().trim().min(10).max(220),
});
export type Feedback = z.infer<typeof FeedbackSchema>;

const NEGATIVE = /\b(you are|you're|youre)\s+(bad|terrible|poor|weak|hopeless)\b|\bfail(ed|ure)\b|\bnot good enough\b/i;
/** Tone gate: encouraging, specific, and never labels the person. */
export const feedbackToneOk = (f: Feedback) => ![f.summary, f.nextStep, ...f.strengths, ...f.focusAreas].some((t) => NEGATIVE.test(t));

export function feedbackPrompt(part: "COMMON" | "CAREER", facts: unknown): { system: string; user: string } {
  return {
    system: `You are a supportive career coach writing short feedback for a student who just finished part of a skills assessment.
Rules: be warm, specific and honest; talk about skills, never about the person ("Power BI is currently an area for development", never "you are bad at X"); use ONLY the facts provided, do not invent scores, tools or outcomes; give exactly one clear next step the student can do this week.
${part === "COMMON" ? "This is the COMMON assessment (communication and basic programming). It is not specific to any career and does not affect their role rating." : "This is the CAREER assessment for the student's chosen role. Skills marked insufficient evidence were not measured enough to judge; say they need more evidence, not that they are weak."}
Reply with ONE JSON object: {"summary": string, "strengths": string[1-3], "focusAreas": string[1-3], "nextStep": string}.`,
    user: `Facts (JSON): ${JSON.stringify(facts)}`,
  };
}
