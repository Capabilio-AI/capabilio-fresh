import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { loadDomainSet } from "@/lib/arena-challenges/domain-set";

/** The student's Domain set for their primary career, or `?career=plan-b`. Read-only. */
export async function GET(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const which = new URL(request.url).searchParams.get("career") === "plan-b" ? "plan-b" : "primary";
  try {
    return NextResponse.json(await loadDomainSet(createServiceClient(), auth.userId, which));
  } catch (error) {
    console.error("[arena/challenges/domain-set]", error);
    return NextResponse.json({ error: "Could not load your Domain challenges. Try again." }, { status: 500 });
  }
}
