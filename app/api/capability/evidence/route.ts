import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { recordCapabilityEvidence } from "@/lib/capability/record-evidence";

const BodySchema = z.object({
  skill: z.string().min(1),
  domain: z.string().min(1),
  newScore: z.number().min(0).max(100),
  source: z.enum(["reassessment", "learning_module", "project", "arena_challenge"]),
});

// userId always comes from the verified session, never the request body —
// otherwise a student could record evidence against another student's
// profile. This endpoint has no independent way to verify a claimed project
// or Arena event actually happened (those systems don't exist yet); once
// they do, they should call this server-to-server rather than a student
// self-reporting their own score here.
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const result = await recordCapabilityEvidence(supabase, createServiceClient(), {
    userId: auth.userId,
    ...parsed.data,
  });
  return NextResponse.json(result);
}
