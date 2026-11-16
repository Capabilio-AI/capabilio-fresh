import { assessRoute } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { isUuid, validateRating } from "@/lib/mentorship/rules";
import { unwrap } from "@/lib/mentorship/route";
import { rateRequest } from "@/lib/mentorship/server";

export const POST = assessRoute<{ id: string }>("mentor_rating", 10, async (req, { userId, params }) => {
  if (!isUuid(params.id)) throw new AssessError("INVALID_REQUEST", "Invalid request.", 400);
  const v = validateRating(await req.json().catch(() => null));
  if (!v.ok) throw new AssessError("INVALID_REQUEST", v.error, 400);
  return unwrap(await rateRequest(userId, params.id, v.value));
});
