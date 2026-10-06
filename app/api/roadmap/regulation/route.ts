import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { RegulationBodySchema, setOwnRegulation } from "@/lib/roadmap-engine/regulation";

/** The student sets which regulation (syllabus scheme) they are on, so only that regulation's published curriculum is used for them. */
export async function PUT(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const parsed = RegulationBodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });
  const r = await setOwnRegulation(createServiceClient(), auth.userId, parsed.data.regulation);
  return r.ok ? NextResponse.json({ ok: true }) : NextResponse.json({ error: r.message }, { status: 400 });
}
