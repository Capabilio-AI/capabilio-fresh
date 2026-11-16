import { AssessError } from "@/lib/assess/types";
import { validateSkill } from "@/lib/professional/skills";
import { unwrap } from "@/lib/professional/respond";
import { idOf, jsonBody, proRoute } from "@/lib/professional/route";
import { removeSkill, updateSkill } from "@/lib/professional/workspace-server";

export const PUT = proRoute<{ id: string }>("pro_skill_edit", 30, async (req, { userId, params }) => {
  const id = idOf(params.id);
  const v = validateSkill(await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_SKILL", v.error, 400);
  return unwrap(await updateSkill(userId, id, v.value));
});

export const DELETE = proRoute<{ id: string }>("pro_skill_delete", 30, async (_req, { userId, params }) => unwrap(await removeSkill(userId, idOf(params.id))));
