import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { generateCareerInterestSection } from "@/lib/assessment/career-interests";

const BodySchema = z.object({ statedRole: z.string().trim().min(2).max(200) });

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: attempt } = await supabase
    .from("assessment_attempts")
    .select("id")
    .eq("user_id", auth.userId)
    .maybeSingle();
  if (!attempt) {
    return NextResponse.json({ error: "Assessment not started" }, { status: 404 });
  }

  const result = await generateCareerInterestSection(
    supabase,
    createServiceClient(),
    attempt.id,
    auth.userId,
    parsed.data.statedRole
  );
  return NextResponse.json(result);
}
