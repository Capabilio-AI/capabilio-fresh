import { AssessError } from "@/lib/assess/types";
import { validateCert, validateEdu, validateLink, validateProject } from "@/lib/professional/records";
import { addRecord, isKind } from "@/lib/professional/records-server";
import { unwrap } from "@/lib/professional/respond";
import { jsonBody, proRoute } from "@/lib/professional/route";

const VALIDATE = { certification: validateCert, education: validateEdu, project: validateProject, link: validateLink } as const;

/** Adds one certification, education entry, project or link. The same checks run here as in the form. */
export const POST = proRoute<{ kind: string }>("pro_record", 30, async (req, { userId, params }) => {
  if (!isKind(params.kind)) throw new AssessError("INVALID_REQUEST", "Invalid request.", 400);
  const v = VALIDATE[params.kind](await jsonBody(req));
  if (!v.ok) throw new AssessError("INVALID_RECORD", v.error, 400);
  return unwrap(await addRecord(userId, params.kind, v.value as never));
});
