import { assessRoute } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { isUuid } from "@/lib/mentorship/rules";
import { openSlotsFor } from "@/lib/mentorship/server";

/** The open times of one mentor, for a signed-in member who could book them. */
export const GET = assessRoute<{ id: string }>("mentor_slots", 60, async (_req, { userId, params }) => {
  if (!isUuid(params.id)) throw new AssessError("INVALID_REQUEST", "Invalid request.", 400);
  const r = await openSlotsFor(userId, params.id);
  if (!r) throw new AssessError("NOT_AVAILABLE", "This mentor has no times you can book right now.", 404);
  return r;
}, { memoryLimit: true });
