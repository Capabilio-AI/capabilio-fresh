import { AssessError } from "@/lib/assess/types";
import { validateAbout } from "@/lib/professional/jobs";
import { saveAbout } from "@/lib/professional/server";
import { jsonBody, proRoute } from "@/lib/professional/route";

export const PUT = proRoute("pro_profile", 20, async (req, { userId }) => {
  const v = validateAbout(await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_PROFILE", v.error, 400);
  await saveAbout(userId, v.value);
  return { ok: true };
});
