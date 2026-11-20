import { after } from "next/server";
import { z } from "zod";
import { assessRoute, readJson } from "@/lib/assess/http";
import { track } from "@/lib/assess/db";
import { rememberStudentAlias } from "@/lib/assess/roles";
import { saveCareerIntent } from "@/lib/careers/intent";
import { roleReplaceBlocked } from "@/lib/careers/role-change";
import { warmPrimaryCareerPool } from "@/lib/assess/warm";
import { AssessError } from "@/lib/assess/types";
import { createServiceClient } from "@/lib/supabase/service";
import { startPathway } from "@/lib/personalization/start";

// the roadmap build and the pool warm-up run after the response, so the function needs the full window
export const maxDuration = 300;

const Body = z.object({ careerId: z.string().uuid(), typed: z.string().max(160).optional(), explore: z.boolean().optional() }).strict();

/**
 * The student's explicit confirmation of the role to be assessed. Warming the question pool starts HERE, in the background, so by the
 * time they finish the common assessment the role's questions already exist and nothing waits on the model later.
 * The role's roadmap (SkillStudio modules and the Career Map) starts building in parallel when it has none; neither waits on the other.
 */
export const POST = assessRoute("assess_role_confirm", 20, async (req, { userId, db }) => {
  const { careerId, typed, explore } = await readJson(req, Body);
  // Fixing a wrongly entered role stays free while the student is onboarding; after that it is the dashboard's "Change role" (3 changes, with a reason).
  const blocked = await roleReplaceBlocked(createServiceClient(), userId, careerId);
  if (blocked) throw new AssessError("ROLE_LOCKED", blocked, 403);
  const result = await saveCareerIntent(createServiceClient(), userId, { primaryCareerId: careerId, isExploring: false });
  if (!result.ok) throw new AssessError("ROLE_REJECTED", result.message, result.status);
  void track(db, userId, "career_role_confirmed", { careerId });
  // the student confirmed this role for these words, so the registry may now learn them (never before: it must not learn an equivalence nobody agreed to)
  if (typed) await rememberStudentAlias(db, careerId, typed).catch(() => undefined);
  if (explore) {
    // Chosen from Explore, so the student goes to SkillStudio: the role's roadmap is built before replying (its modules must be there on arrival).
    // The role's questions are written now, in the background, so the role assessment never waits on the model when it is taken later.
    after(() => warmPrimaryCareerPool(userId));
    await startPathway(createServiceClient(), careerId).catch((e) => console.error("[assess] could not start the pathway:", e));
    return { ok: true };
  }
  after(() => warmPrimaryCareerPool(userId));
  // the roadmap setup runs after the response so "Confirm" is not held up by it; a failure must never undo the confirmed role, the status panel shows it and offers a retry
  after(() => startPathway(createServiceClient(), careerId).catch((e) => console.error("[assess] could not start the pathway:", e)));
  return { ok: true };
});
