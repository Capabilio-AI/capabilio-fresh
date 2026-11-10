import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { failureResponse, overLimit } from "@/lib/assess/http";
import { AssessError } from "@/lib/assess/types";
import { ChecklistBody, StateQuery, SubmitBody } from "@/lib/roadmap-visual/project-submission";
import { finishPending, getSubmissionView, loadProjectScope, saveChecklist, submitProject } from "@/lib/roadmap-visual/project-submission-server";

// Submitting reads the linked repository from GitHub and then asks the model, which can take a while.
export const maxDuration = 60;

const NOT_AVAILABLE = () => new AssessError("NOT_AVAILABLE", "That project isn't on your roadmap.", 404);

/** The student's own submission for one roadmap project (or an empty one), with the proof advice that fits the project. */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limited = await overLimit(auth.userId, "project_submission_state", 60);
  if (limited) return limited;
  try {
    const query = StateQuery.parse(Object.fromEntries(new URL(request.url).searchParams));
    const service = createServiceClient();
    const found = await loadProjectScope(service, auth.userId, query.resourceId, query.career);
    if (!found) throw NOT_AVAILABLE();
    const view = await getSubmissionView(service, auth.userId, found.resource);
    // a verified project whose skill updates did not finish is completed on the next visit
    return NextResponse.json({ submission: view.status === "verified" && !view.appliedAt ? await finishPending(service, auth.userId, found.resource, found.scope) : view });
  } catch (e) {
    return failureResponse(e, "project_submission_state");
  }
}

/** Ticks on the "you are done when" checklist. */
export async function PUT(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limited = await overLimit(auth.userId, "project_submission_checklist", 60);
  if (limited) return limited;
  try {
    const Body = ChecklistBody;
    const body = Body.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const service = createServiceClient();
    const found = await loadProjectScope(service, auth.userId, body.data.resourceId, body.data.career);
    if (!found) throw NOT_AVAILABLE();
    return NextResponse.json({ submission: await saveChecklist(service, auth.userId, found.resource, found.scope.careerId, body.data.checked) });
  } catch (e) {
    return failureResponse(e, "project_submission_checklist");
  }
}

/** Saves the proof and opens the explain-your-work check. The model call lives here, so the limit is low. */
export async function POST(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limited = await overLimit(auth.userId, "project_submission_submit", 5);
  if (limited) return limited;
  try {
    const Body = SubmitBody;
    const body = Body.safeParse(await request.json().catch(() => null));
    if (!body.success) return NextResponse.json({ error: body.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });
    const service = createServiceClient();
    const found = await loadProjectScope(service, auth.userId, body.data.resourceId, body.data.career);
    if (!found) throw NOT_AVAILABLE();
    return NextResponse.json({ submission: await submitProject(service, auth.userId, found.resource, found.scope.careerId, body.data) });
  } catch (e) {
    return failureResponse(e, "project_submission_submit");
  }
}
