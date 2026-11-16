import { AssessError } from "@/lib/assess/types";
import { removeProJob } from "@/lib/professional/server";
import { idOf, proRoute } from "@/lib/professional/route";

export const DELETE = proRoute<{ id: string }>("pro_job_delete", 20, async (_req, { userId, params }) => {
  if (!(await removeProJob(userId, idOf(params.id)))) throw new AssessError("NOT_FOUND", "That job is not on your profile.", 404);
  return { ok: true };
});
