import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { getWorkstationCareer } from "@/lib/career/workstation-career";
import { loadPublicAttempt, studentRoleKey } from "@/lib/arena-workstations/attempts";
import { untyped } from "@/lib/org/db";
import { loadExperienceLevel } from "@/lib/workplace/level-server";
import { currentSession, SPECS, startSession } from "@/lib/arena-roles/session/service";
import { supabaseSessionStore } from "@/lib/arena-roles/session/supabase-store";
import { sessionErrorResponse } from "@/lib/arena-roles/session/http";

/** The student's Proof Session state: whether their role has one, and the open session if any. Read-only. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  try {
    const service = createServiceClient();
    const roleKey = await studentRoleKey(service, auth.userId, await getWorkstationCareer(service, auth.userId));
    if (!roleKey || !SPECS[roleKey]) return NextResponse.json({ available: false, session: null });
    const level = await loadExperienceLevel(service, auth.userId);
    const session = await currentSession(supabaseSessionStore(service), { userId: auth.userId, roleKey, level });
    // every stage passed: the last stage's attempt is the one the interview hangs off
    const last = session && session.current === null ? session.stages[session.stages.length - 1] : null;
    const anchorAttempt = last?.assignmentId ? await loadPublicAttempt(service, auth.userId, last.assignmentId) : null;
    const { data: finished } = await untyped(service).from("arena_proof_sessions").select("id").eq("user_id", auth.userId).eq("role_key", roleKey).eq("status", "finished").order("started_at", { ascending: false }).limit(1);
    return NextResponse.json({ available: true, spec: { title: SPECS[roleKey].title, intro: SPECS[roleKey].intro }, session, anchorAttempt, latestFinishedSessionId: (finished as { id: string }[] | null)?.[0]?.id ?? null });
  } catch (error) {
    return sessionErrorResponse(error, "arena/sessions");
  }
}

/** Starts a Proof Session (or returns the open one). The role comes from the server, never from the request. */
export async function POST() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  const rateLimit = await checkRateLimit(auth.userId, { bucket: "arena_session_start", maxRequests: 6, windowSeconds: 600 });
  if (!rateLimit.allowed) return rateLimitedResponse(rateLimit.remaining);
  try {
    const service = createServiceClient();
    const roleKey = await studentRoleKey(service, auth.userId, await getWorkstationCareer(service, auth.userId));
    if (!roleKey) return NextResponse.json({ error: "There is no workstation for your target role yet.", reason: "no_role" }, { status: 409 });
    const level = await loadExperienceLevel(service, auth.userId);
    return NextResponse.json({ session: await startSession(supabaseSessionStore(service), { userId: auth.userId, roleKey, level }) });
  } catch (error) {
    return sessionErrorResponse(error, "arena/sessions");
  }
}
