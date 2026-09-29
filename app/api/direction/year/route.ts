import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { saveProgramYears } from "@/lib/career/direction-writes";

// strict(): any extra key (goal_state, userId, assessment mode…) is a 400, never silently trusted.
const BodySchema = z
  .object({
    startYear: z.number().int(),
    endYear: z.number().int(),
    currentYearOverride: z.number().int().min(1).max(8).nullable(),
  })
  .strict();

/** Confirm or correct program years + optional current-year override for the signed-in student. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const result = await saveProgramYears(createServiceClient(), auth.userId, parsed.data);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true });
}
