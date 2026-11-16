import { AssessError } from "@/lib/assess/types";
import { validateNote } from "@/lib/professional/pulse";
import { createNote } from "@/lib/professional/pulse-server";
import { jsonBody, proRoute } from "@/lib/professional/route";

export const POST = proRoute("pro_note", 10, async (req, { userId }) => {
  const v = validateNote(((await jsonBody(req)) as { body?: unknown })?.body);
  if (!v.ok) throw new AssessError("INVALID_NOTE", v.error, 400);
  await createNote(userId, v.value);
  return { ok: true };
});
