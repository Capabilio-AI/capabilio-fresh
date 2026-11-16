import { unwrap } from "@/lib/professional/respond";
import { idOf, proRoute } from "@/lib/professional/route";
import { deleteFeedback } from "@/lib/professional/workspace-server";

export const DELETE = proRoute<{ id: string }>("pro_feedback_delete", 30, async (_req, { userId, params }) => unwrap(await deleteFeedback(userId, idOf(params.id))));
