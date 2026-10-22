import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { loadExperienceLevel } from "@/lib/workplace/level-server";
import { finalizeReport, SessionError } from "@/lib/arena-roles/session/service";
import { supabaseSessionStore } from "@/lib/arena-roles/session/supabase-store";
import { sessionErrorResponse } from "@/lib/arena-roles/session/http";

/** The report of a finished session. Private to the student; there is no sharing route. */
export async function GET(_request: Request, { params }: { params: Promise<{ sessionId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const { sessionId } = await params;
  try {
    const service = createServiceClient();
    const store = supabaseSessionStore(service);
    const session = await store.session(auth.userId, sessionId);
    if (!session) throw new SessionError("Session not found.", 404, "not_found");
    if (session.status === "open") throw new SessionError("The report is ready once the session is finished.", 409, "not_finished");
    return NextResponse.json({ report: await finalizeReport(store, { userId: auth.userId, sessionId, level: await loadExperienceLevel(service, auth.userId) }) });
  } catch (error) {
    return sessionErrorResponse(error, "arena/sessions/report");
  }
}
