import { AssessError } from "@/lib/assess/types";
import { unwrap } from "@/lib/mentorship/route";
import { respond, type MentorAction } from "@/lib/mentorship/server";
import { idOf, jsonBody, proRoute } from "@/lib/professional/route";

/** The mentor's answer: approve (with the meeting link), decline, mark complete, or cancel. */
export const POST = proRoute<{ id: string }>("pro_mentor_respond", 30, async (req, { userId, params }) => {
  const id = idOf(params.id);
  const body = (await jsonBody(req)) as Record<string, unknown>;
  let action: MentorAction;
  if (body.action === "accept") {
    action = { action: "accept", meetingUrl: body.meetingUrl, startsAt: body.startsAt };
  } else if (body.action === "decline") {
    const note = typeof body.note === "string" ? body.note.trim() : "";
    if (note.length > 300) throw new AssessError("INVALID_REQUEST", "Keep the note under 300 characters.", 400);
    action = { action: "decline", note: note || null };
  } else if (body.action === "complete" || body.action === "cancel") {
    action = { action: body.action };
  } else {
    throw new AssessError("INVALID_REQUEST", "Invalid request.", 400);
  }
  return unwrap(await respond(userId, id, action));
});
