import { after } from "next/server";
import { z } from "zod";
import { assessRoute, readJson } from "@/lib/assess/http";
import { track } from "@/lib/assess/db";
import { saveCareerIntent } from "@/lib/careers/intent";
import { warmPrimaryCareerPool } from "@/lib/assess/warm";
import { AssessError } from "@/lib/assess/types";
import { createServiceClient } from "@/lib/supabase/service";
import { startPathway } from "@/lib/personalization/start";

// the roadmap build and the pool warm-up run after the response, so the function needs the full window
export const maxDuration = 300;

const Body = z.object({ careerId: z.string().uuid() }).strict();

/**
 * The student's explicit confirmation of the role to be assessed. Warming the question pool starts HERE, in the background, so by the
 * time they finish the common assessment the role's questions already exist and nothing waits on the model later.
 * The role's roadmap (SkillStudio modules and the Career Map) starts building in parallel when it has none; neither waits on the other.
 */
export const POST = assessRoute("assess_role_confirm", 20, async (req, { userId, db }) => {
  const { careerId } = await readJson(req, Body);
  const result = await saveCareerIntent(createServiceClient(), userId, { primaryCareerId: careerId, isExploring: false });
  if (!result.ok) throw new AssessError("ROLE_REJECTED", result.message, result.status);
  void track(db, userId, "career_role_confirmed", { careerId });
  after(() => warmPrimaryCareerPool(userId));
  // a failure to start the pathway must never undo the confirmed role; the status panel shows it and offers a retry
  await startPathway(createServiceClient(), careerId).catch((e) => console.error("[assess] could not start the pathway:", e));
  return { ok: true };
});
