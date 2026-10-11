import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { portfolioPulse } from "@/lib/portfolio/pulse";

/** The signed-in student's own portfolio fingerprint: the dashboard portfolio polls this and refreshes when it changes. */
export async function GET() {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  return NextResponse.json(await portfolioPulse(createServiceClient(), auth.userId), { headers: { "Cache-Control": "no-store" } });
}
