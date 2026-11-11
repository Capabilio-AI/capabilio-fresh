import { after } from "next/server";
import { z } from "zod";
import { assessRoute, readJson } from "@/lib/assess/http";
import { submitSession } from "@/lib/assess/finalize";
import { refreshRoadmap } from "@/lib/assess/roadmap";
import { generateFeedback } from "@/lib/assess/feedback";

export const maxDuration = 60;
const Id = z.string().uuid();
const Body = z.object({ reason: z.enum(["student", "integrity"]) }).strict();

/**
 * Ends the assessment now. The student chose to end it, or the exam lock ended it for too many fullscreen exits or tab switches. Only the questions
 * answered count; the result records why it ended. Idempotent, like submit.
 */
export const POST = assessRoute<{ id: string }>("assess_end", 10, async (req, { userId, db, params }) => {
  const sessionId = Id.parse(params.id);
  const { reason } = await readJson(req, Body);
  const result = await submitSession(db, userId, sessionId, (done) => {
    after(() => generateFeedback(db, userId, sessionId, done));
    if (done.layer === "CAREER") after(() => refreshRoadmap(userId));
  }, { early: reason });
  return { result };
});
