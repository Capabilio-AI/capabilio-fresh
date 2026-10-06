import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireOrgAdmin } from "@/lib/roadmap/admin-gate";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { suggestSkillsForImport } from "@/lib/roadmap/extract/suggest-skills";

// One request handles a bounded number of courses (well inside this limit); the client repeats until `remaining` is 0.
export const maxDuration = 300;

/**
 * Suggest canonical skills for the next unprocessed courses of one of the caller's OWN unpublished imports. Writes only
 * SUGGESTED / AI_SUGGESTED mappings and review-queue entries — nothing here confirms anything or reaches a student.
 */
export async function POST(_request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const admin = await requireOrgAdmin(supabase);
  if ("error" in admin) return admin.error;
  const id = z.string().uuid().safeParse((await params).id);
  if (!id.success) return NextResponse.json({ error: "Invalid request." }, { status: 400 });

  const limit = await checkRateLimit(admin.userId, { bucket: "curriculum_suggest_skills", maxRequests: 60, windowSeconds: 3600 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);

  const result = await suggestSkillsForImport(createServiceClient(), { institutionId: admin.institutionId }, id.data);
  if (!result.ok) return NextResponse.json({ error: result.message }, { status: result.status });
  return NextResponse.json({ ok: true, processed: result.processed, remaining: result.remaining, suggested: result.suggested, unresolved: result.unresolved, failedBatches: result.failedBatches });
}
