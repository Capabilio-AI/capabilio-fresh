import { AssessError } from "@/lib/assess/types";
import { validateApplication } from "@/lib/professional/tracker";
import { unwrap } from "@/lib/professional/respond";
import { jsonBody, proRoute } from "@/lib/professional/route";
import { createApplication } from "@/lib/professional/workspace-server";

export const POST = proRoute("pro_application", 30, async (req, { userId }) => {
  const v = validateApplication(await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_APPLICATION", v.error, 400);
  return unwrap(await createApplication(userId, v.value));
});
