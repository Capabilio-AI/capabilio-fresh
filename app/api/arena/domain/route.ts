import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { getWorkstationCareer } from "@/lib/career/workstation-career";
import { getWorkstationState } from "@/lib/arena-workstations/attempts";
import { attemptErrorResponse } from "@/lib/arena-workstations/http";

/** Read-only Domain workstation state. Never generates a task. */
export async function GET() {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  try {
    const service = createServiceClient();
    return NextResponse.json(await getWorkstationState(service, auth.userId, await getWorkstationCareer(service, auth.userId)));
  } catch (error) {
    return attemptErrorResponse(error, "arena/domain");
  }
}
