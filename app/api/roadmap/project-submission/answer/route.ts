import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { failureResponse, overLimit } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { AnswerBody } from "@/lib/roadmap-visual/project-submission";
import { answerProject, loadProjectScope } from "@/lib/roadmap-visual/project-submission-server";

export const maxDuration = 60;

/** Scores the answers. A pass verifies the project and updates the career's skills, readiness and roadmap. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limited = await overLimit(auth.userId, "project_submission_answer", 5);
  if (limited) return limited;
  try {
    const Body = AnswerBody;
    const body = Body.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const service = createServiceClient();
    const found = await loadProjectScope(service, auth.userId, body.data.resourceId, body.data.career);
    if (!found) throw new AssessError("NOT_AVAILABLE", "That project isn't on your roadmap.", 404);
    return NextResponse.json({ submission: await answerProject(service, auth.userId, found.resource, found.scope, body.data.answers) });
  } catch (e) {
    return failureResponse(e, "project_submission_answer");
  }
}
