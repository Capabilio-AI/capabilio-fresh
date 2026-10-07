import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { recommendChallengesForSkill } from "@/lib/arena-challenges/domain-set";

const Query = z.object({ skillId: z.string().uuid(), careerId: z.string().uuid().optional() });

/** Recommended published challenges for one canonical skill (and optionally a career). Read-only; used by the Roadmap page. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const params = Object.fromEntries(new URL(request.url).searchParams);
  const parsed = Query.safeParse(params);
  if (!parsed.success) return NextResponse.json({ error: "skillId (uuid) is required; careerId must be a uuid." }, { status: 400 });

  try {
    const challenges = await recommendChallengesForSkill(createServiceClient(), auth.userId, parsed.data.skillId, parsed.data.careerId ?? null);
    return NextResponse.json({ challenges });
  } catch (error) {
    console.error("[arena/challenges/recommended]", error);
    return NextResponse.json({ error: "Could not load recommendations. Try again." }, { status: 500 });
  }
}
