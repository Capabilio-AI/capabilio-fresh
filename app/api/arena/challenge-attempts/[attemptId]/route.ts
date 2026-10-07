import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { attemptErrorResponse, loadAttemptView } from "@/lib/arena-challenges/attempts";

/** Everything needed to render (or resume) one of the caller's attempts. */
export async function GET(_request: Request, { params }: { params: Promise<{ attemptId: string }> }) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;
  try {
    return NextResponse.json(await loadAttemptView(createServiceClient(), auth.userId, (await params).attemptId));
  } catch (error) {
    return attemptErrorResponse(error, "arena/challenge-attempts/get");
  }
}
