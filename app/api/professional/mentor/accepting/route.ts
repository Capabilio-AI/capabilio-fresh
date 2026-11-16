import { AssessError } from "@/lib/assess/types";
import { setMentorAccepting } from "@/lib/mentorship/server";
import { jsonBody, proRoute } from "@/lib/professional/route";

export const PUT = proRoute("pro_mentor_accepting", 20, async (req, { userId }) => {
  const body = (await jsonBody(req)) as { accepting?: unknown };
  if (typeof body?.accepting !== "boolean") throw new AssessError("INVALID_REQUEST", "Invalid request.", 400);
  if (!(await setMentorAccepting(userId, body.accepting))) throw new AssessError("NOT_APPROVED", "You can change this once Capabilio has approved your profile.", 409);
  return { ok: true };
});
