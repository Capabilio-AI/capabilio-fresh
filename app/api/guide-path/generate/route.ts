import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { generateGuidePathForCareer } from "@/lib/guide-path/generate";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";

const BodySchema = z.object({
  targetCareer: z.string().min(1),
  // Plan B: a secondary explored career alongside the primary path.
  isPrimary: z.boolean().default(true),
});

export async function POST(request: Request) {
  const supabase = await createClient();
  const auth = await requireUser(supabase);
  if ("error" in auth) return auth.error;

  // every change of target career is a paid model call, so cap how often one account can trigger them
  const limit = await checkRateLimit(auth.userId, { bucket: "guide_path_generate", maxRequests: 5, windowSeconds: 3600, failClosed: true });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const parsed = BodySchema.safeParse(await request.json().catch(() => null));
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
