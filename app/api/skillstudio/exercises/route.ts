import { NextResponse, after } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { failureResponse, overLimit } from "@/lib/assess/http";
import { publicExercise, type TopicSource } from "@/lib/practice/practice";
import { exercisesFor, loadExercises, loadProgress, recentlyFailed, resolveTopic } from "@/lib/practice/server";

// Writing and verifying a lesson's exercises runs after the response, and a slow shared runner can take minutes.
export const maxDuration = 300;

const key = z.string().regex(/^[a-z0-9][a-z0-9-]{1,80}$/);
const Query = z.union([
  z.object({ nodeKey: key }).strict().transform((q): TopicSource => ({ kind: "topic", nodeKey: q.nodeKey })),
  z.object({ track: key, lessonKey: key }).strict().transform((q): TopicSource => ({ kind: "track", track: q.track, lessonKey: q.lessonKey })),
]);

/**
 * A lesson's practice exercises, as a student may see them (never the solution or the hidden answers).
 *  none        this lesson has no practice (not a language we can run)
 *  ready       the exercises, with the student's progress on each
 *  pending     being written and checked right now; ask again in a few seconds
 *  unavailable could not be built just now; try again later
 */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limited = await overLimit(auth.userId, "lesson_exercises", 30);
  if (limited) return limited;
  try {
    const source = Query.safeParse(Object.fromEntries(new URL(request.url).searchParams));
    if (!source.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
    const service = createServiceClient();
    const topic = await resolveTopic(service, auth.userId, source.data);
    if (!topic) return NextResponse.json({ status: "none" });

    const stored = await loadExercises(service, topic.key);
    if (stored.length > 0) {
      const progress = await loadProgress(service, auth.userId, stored.map((e) => e.id));
      return NextResponse.json({ status: "ready", language: topic.language, exercises: stored.map(publicExercise), progress });
    }
    if (recentlyFailed(topic.key)) return NextResponse.json({ status: "unavailable" });
    after(() => exercisesFor(service, auth.userId, topic).catch((e) => console.error("[practice]", e instanceof Error ? e.message : e)));
    return NextResponse.json({ status: "pending" }, { status: 202 });
  } catch (e) {
    return failureResponse(e, "lesson_exercises");
  }
}
