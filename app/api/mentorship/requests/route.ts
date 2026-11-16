import { assessRoute } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { validateRequest } from "@/lib/mentorship/rules";
import { unwrap } from "@/lib/mentorship/route";
import { createRequest, listMyRequests } from "@/lib/mentorship/server";

async function body(req: Request): Promise<unknown> {
  try { return await req.json(); } catch { throw new AssessError("INVALID_REQUEST", "Invalid request.", 400); }
}

/** A student, recently graduated user or professional asks an approved mentor for a session. */
export const POST = assessRoute("mentor_request", 5, async (req, { userId }) => {
  const v = validateRequest(await body(req));
  if (!v.ok) throw new AssessError("INVALID_REQUEST", v.error, 400);
  return unwrap(await createRequest(userId, v.value));
});

/** The caller's own session requests, newest first. */
export const GET = assessRoute("mentor_requests_list", 60, async (_req, { userId }) => ({ requests: await listMyRequests(userId) }), { memoryLimit: true });
