import { z } from "zod";
import { assessRoute } from "@/lib/assess/http";
import { generateFeedback, readFeedback } from "@/lib/assess/feedback";
import { loadSession } from "@/lib/assess/session";
import type { AssessmentResult } from "@/lib/assess/types";

export const maxDuration = 60;
const Id = z.string().uuid();
/** After this long without AI feedback the template is stored, so a slow or failed model can never leave the popup waiting. */
const PATIENCE_MS = 25_000;

/** Polled by the result popup. READY once both parts exist; otherwise PENDING (skeleton), or the template once patience runs out. */
export const GET = assessRoute<{ id: string }>("assess_feedback", 60, async (_req, { userId, db, params }) => {
  const session = await loadSession(db, userId, Id.parse(params.id));
  if (session.status !== "COMPLETED" || !session.result) return { status: "PENDING", feedback: [] };
  const result = session.result as AssessmentResult;
  const want = (result.general ? 1 : 0) + (result.layer === "CAREER" ? 1 : 0);
  let feedback = await readFeedback(db, session.id);
  if (feedback.length >= want) return { status: "READY", feedback };
  const age = Date.now() - new Date(result.completedAt).getTime();
  if (age > PATIENCE_MS) feedback = await generateFeedback(db, userId, session.id, result, { templateOnly: true });
  return feedback.length >= want ? { status: "READY", feedback } : { status: "PENDING", feedback };
}, { memoryLimit: true });
