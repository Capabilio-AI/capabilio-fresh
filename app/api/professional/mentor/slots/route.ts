import { AssessError } from "@/lib/assess/types";
import { validateSlots } from "@/lib/mentorship/rules";
import { unwrap } from "@/lib/mentorship/route";
import { mentorSettings, setDaySlots } from "@/lib/mentorship/server";
import { jsonBody, proRoute } from "@/lib/professional/route";

/** Sets the open slots for one date: the times listed are open, other open times that day are removed. */
export const PUT = proRoute("pro_mentor_slots", 30, async (req, { userId }) => {
  const settings = await mentorSettings(userId);
  if (!settings) throw new AssessError("NO_PROFILE", "Set up your mentor profile first.", 409);
  const body = await jsonBody(req);
  const v = validateSlots(body, settings.sessionMinutes, settings.timezone);
  if (!v.ok) throw new AssessError("INVALID_SLOTS", v.error, 400);
  return unwrap(await setDaySlots(userId, (body as { date: string }).date, v.value, settings.timezone));
});
