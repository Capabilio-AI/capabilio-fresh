import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { getWorkstationState } from "@/lib/arena-workstations/attempts";
import { attemptErrorResponse } from "@/lib/arena-workstations/http";

/** Read-only Domain workstation state. Never generates a task. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  try {
    const statedRole = await getStatedCareerInterest(supabase, auth.userId);
    return NextResponse.json(await getWorkstationState(createServiceClient(), auth.userId, statedRole));
  } catch (error) {
    return attemptErrorResponse(error, "arena/domain");
  }
}
