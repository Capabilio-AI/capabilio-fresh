import { AssessError } from "@/lib/assess/types";
import { deleteNote } from "@/lib/professional/pulse-server";
import { idOf, proRoute } from "@/lib/professional/route";

export const DELETE = proRoute<{ id: string }>("pro_note_delete", 20, async (_req, { userId, params }) => {
  if (!(await deleteNote(userId, idOf(params.id)))) throw new AssessError("NOT_FOUND", "That note is not yours or is already gone.", 404);
  return { ok: true };
});
