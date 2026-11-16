import { AssessError } from "@/lib/assess/types";
import { validateFeedback } from "@/lib/professional/tracker";
import { unwrap } from "@/lib/professional/respond";
import { jsonBody, proRoute } from "@/lib/professional/route";
import { addFeedback } from "@/lib/professional/workspace-server";

export const POST = proRoute("pro_feedback", 30, async (req, { userId }) => {
  const v = validateFeedback(await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_FEEDBACK", v.error, 400);
  return unwrap(await addFeedback(userId, v.value));
});
