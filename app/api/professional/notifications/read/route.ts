import { AssessError } from "@/lib/assess/types";
import { markAllRead } from "@/lib/professional/notifications";
import { proRoute } from "@/lib/professional/route";

export const POST = proRoute("pro_alerts_read", 30, async (_req, { userId }) => {
  if (!(await markAllRead(userId))) throw new AssessError("SAVE_FAILED", "That did not save. Try again.", 500);
  return { ok: true };
});
