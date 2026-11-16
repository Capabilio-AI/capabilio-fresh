import { AssessError } from "@/lib/assess/types";
import { validateComment } from "@/lib/professional/pulse";
import { addComment } from "@/lib/professional/pulse-server";
import { idOf, jsonBody, proRoute } from "@/lib/professional/route";

export const POST = proRoute<{ id: string }>("pro_comment", 20, async (req, { userId, params }) => {
  const postId = idOf(params.id);
  const body = (await jsonBody(req)) as { body?: unknown };
  const v = validateComment(body?.body);
  if (!v.ok) throw new AssessError("INVALID_COMMENT", v.error, 400);
  const id = await addComment(userId, postId, v.value);
  if (!id) throw new AssessError("NOT_FOUND", "That post is gone.", 404);
  return { id };
});
