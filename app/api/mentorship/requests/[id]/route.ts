import { assessRoute } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { isUuid } from "@/lib/mentorship/rules";
import { unwrap } from "@/lib/mentorship/route";
import { cancelMyRequest } from "@/lib/mentorship/server";

export const DELETE = assessRoute<{ id: string }>("mentor_request_cancel", 20, async (_req, { userId, params }) => {
  if (!isUuid(params.id)) throw new AssessError("INVALID_REQUEST", "Invalid request.", 400);
  return unwrap(await cancelMyRequest(userId, params.id));
});
