import { AssessError } from "@/lib/assess/types";
import { validateApplicationUpdate } from "@/lib/professional/tracker";
import { unwrap } from "@/lib/professional/respond";
import { idOf, jsonBody, proRoute } from "@/lib/professional/route";
import { deleteApplication, updateApplication } from "@/lib/professional/workspace-server";

export const PATCH = proRoute<{ id: string }>("pro_application_edit", 60, async (req, { userId, params }) => {
  const id = idOf(params.id);
  const v = validateApplicationUpdate(await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_APPLICATION", v.error, 400);
  return unwrap(await updateApplication(userId, id, v.value));
});

export const DELETE = proRoute<{ id: string }>("pro_application_delete", 30, async (_req, { userId, params }) => unwrap(await deleteApplication(userId, idOf(params.id))));
