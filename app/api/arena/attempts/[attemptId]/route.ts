import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getAttemptEvidence } from "@/lib/arena/attempt-evidence";

/** Backs the owner's evidence popup in the Portfolio — session user must own the attempt. */
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const { attemptId } = await params;
  if (!/^[0-9a-f-]{36}$/i.test(attemptId)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const evidence = await getAttemptEvidence(createServiceClient(), attemptId, auth.userId);
  if (!evidence) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(evidence);
}
