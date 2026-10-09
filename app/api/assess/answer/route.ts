import { after } from "next/server";
import { z } from "zod";
import { assessRoute, readJson } from "@/lib/assess/http";
import { answerQuestion, refillBuffer } from "@/lib/assess/session";

// Only the choice is accepted. Scores, correctness and ELO are computed in the database; a body cannot set them.
const Body = z.object({
  sessionQuestionId: z.string().uuid(),
  attemptId: z.string().uuid(),
  optionIndex: z.number().int().min(-1).max(5), // -1 = the clock ran out
  responseMs: z.number().int().min(0).max(3_600_000).optional(),
}).strict();

export const POST = assessRoute("assess_answer", 120, async (req, { userId, db }) => {
  const input = await readJson(req, Body);
  const feedback = await answerQuestion(db, userId, input);
  // adapt in the background: rebuild the next-questions buffer for the student's new level
  if (!feedback.alreadyAnswered && !feedback.isLast) after(() => refillBuffer(db, userId, feedback.sessionId).catch((e) => console.error("[assess] refill failed:", e)));
  return feedback;
}, { memoryLimit: true });
