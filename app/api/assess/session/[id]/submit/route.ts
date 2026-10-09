import { after } from "next/server";
import { z } from "zod";
import { assessRoute } from "@/lib/assess/http";
import { submitSession } from "@/lib/assess/finalize";
import { refreshRoadmap } from "@/lib/assess/roadmap";
import { generateFeedback } from "@/lib/assess/feedback";

export const maxDuration = 60;
const Id = z.string().uuid();

/** Finalises a fully answered session. Rejected until every question has an answer. Idempotent. */
export const POST = assessRoute<{ id: string }>("assess_submit", 10, async (_req, { userId, db, params }) => {
  const result = await submitSession(db, userId, Id.parse(params.id));
  // AI feedback is generated after the response so Submit is instant; the popup shows a skeleton and polls /feedback
  after(() => generateFeedback(db, userId, Id.parse(params.id), result));
  if (result.layer === "CAREER") after(() => refreshRoadmap(userId));
  return { result };
});
