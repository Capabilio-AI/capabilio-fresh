import { AssessError } from "@/lib/assess/types";
import { isKind, removeRecord } from "@/lib/professional/records-server";
import { unwrap } from "@/lib/professional/respond";
import { idOf, proRoute } from "@/lib/professional/route";

export const DELETE = proRoute<{ kind: string; id: string }>("pro_record_delete", 30, async (_req, { userId, params }) => {
  if (!isKind(params.kind)) throw new AssessError("INVALID_REQUEST", "Invalid request.", 400);
  return unwrap(await removeRecord(userId, params.kind, idOf(params.id)));
});
