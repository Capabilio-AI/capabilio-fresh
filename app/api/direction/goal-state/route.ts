import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { saveGoalState } from "@/lib/career/direction-writes";
import { GoalStateBodySchema } from "@/lib/career/schemas";

/** Change the signed-in student's own goal state. The target row comes from the session, never from the body. */
export async function PUT(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = GoalStateBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await saveGoalState(createServiceClient(), auth.userId, parsed.data.goalState);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, goalState: parsed.data.goalState });
}
