import { AssessError } from "@/lib/assess/types";
import { isReason } from "@/lib/professional/pulse";
import { reportPost } from "@/lib/professional/pulse-server";
import { idOf, jsonBody, proRoute } from "@/lib/professional/route";

export const POST = proRoute<{ id: string }>("pro_report", 10, async (req, { userId, params }) => {
  const postId = idOf(params.id);
  const body = (await jsonBody(req)) as { reason?: unknown };
  if (!isReason(body?.reason)) throw new AssessError("INVALID_REQUEST", "Choose a reason.", 400);
  if (!(await reportPost(userId, postId, body.reason))) throw new AssessError("NOT_FOUND", "That post is gone.", 404);
  return { ok: true };
});
