import { AssessError } from "@/lib/assess/types";
import { validateSkill } from "@/lib/professional/skills";
import { unwrap } from "@/lib/professional/respond";
import { jsonBody, proRoute } from "@/lib/professional/route";
import { addSkill } from "@/lib/professional/workspace-server";

export const POST = proRoute("pro_skill", 30, async (req, { userId }) => {
  const v = validateSkill(await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_SKILL", v.error, 400);
  return unwrap(await addSkill(userId, v.value));
});
