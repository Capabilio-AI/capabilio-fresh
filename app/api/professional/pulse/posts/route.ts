import { AssessError } from "@/lib/assess/types";
import { validatePost } from "@/lib/professional/pulse";
import { createPost } from "@/lib/professional/pulse-server";
import { jsonBody, proRoute } from "@/lib/professional/route";

export const POST = proRoute("pro_post", 6, async (req, { userId }) => {
  const v = validatePost(await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_POST", v.error, 400);
  return { id: await createPost(userId, v.value) };
});
