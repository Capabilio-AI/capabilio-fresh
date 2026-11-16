import { AssessError } from "@/lib/assess/types";
import { toggleLike } from "@/lib/professional/pulse-server";
import { idOf, proRoute } from "@/lib/professional/route";

export const POST = proRoute<{ id: string }>("pro_like", 90, async (_req, { userId, params }) => {
  const liked = await toggleLike(userId, idOf(params.id));
  if (liked === null) throw new AssessError("NOT_FOUND", "That post is gone.", 404);
  return { liked };
});
