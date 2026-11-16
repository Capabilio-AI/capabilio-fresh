import { AssessError } from "@/lib/assess/types";
import { toggleFollow } from "@/lib/professional/pulse-server";
import { idOf, jsonBody, proRoute } from "@/lib/professional/route";

export const POST = proRoute("pro_follow", 30, async (req, { userId }) => {
  const body = (await jsonBody(req)) as { userId?: unknown };
  const following = await toggleFollow(userId, idOf(body?.userId));
  if (following === null) throw new AssessError("NOT_FOUND", "You can only follow other working professionals.", 404);
  return { following };
});
