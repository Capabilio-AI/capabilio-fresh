import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { generateGuidePathForCareer } from "@/lib/guide-path/generate";

const BodySchema = z.object({
  targetCareer: z.string().min(1),
  // Plan B: a secondary explored career alongside the primary path.
  isPrimary: z.boolean().default(true),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  const parsed = BodySchema.safeParse(await request.json());
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
  }

  const { data: careerExists } = await supabase
    .from("career_requirements")
    .select("career_role")
    .eq("career_role", parsed.data.targetCareer)
    .maybeSingle();
  if (!careerExists) {
    return NextResponse.json({ error: "Unknown career role" }, { status: 404 });
  }

  const result = await generateGuidePathForCareer(
    supabase,
    createServiceClient(),
    auth.userId,
    parsed.data.targetCareer,
    parsed.data.isPrimary
  );
  return NextResponse.json(result);
}
