import { AssessError } from "@/lib/assess/types";
import { validateMentorProfile } from "@/lib/mentorship/rules";
import { unwrap } from "@/lib/mentorship/route";
import { saveMentorProfile } from "@/lib/mentorship/server";
import { jsonBody, proRoute } from "@/lib/professional/route";

export const PUT = proRoute("pro_mentor_profile", 10, async (req, { userId }) => {
  const v = validateMentorProfile(await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_PROFILE", v.error, 400);
  return unwrap(await saveMentorProfile(userId, v.value));
});
