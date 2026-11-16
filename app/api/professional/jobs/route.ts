import { AssessError } from "@/lib/assess/types";
import { validateJob } from "@/lib/professional/jobs";
import { addProJob } from "@/lib/professional/server";
import { jsonBody, proRoute } from "@/lib/professional/route";

export const POST = proRoute("pro_job", 20, async (req, { userId }) => {
  const v = validateJob(await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_JOB", v.error, 400);
  const saved = await addProJob(userId, { employerName: v.value.employerName, jobTitle: v.value.jobTitle, employedSince: v.value.start, employedUntil: v.value.end });
  if (!saved) throw new AssessError("SAVE_FAILED", "That job could not be saved. Try again.", 500);
  return { ok: true };
});
