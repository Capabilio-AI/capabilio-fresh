import { z } from "zod";
import { assessRoute, readJson } from "@/lib/assess/http";
import { track } from "@/lib/assess/db";
import { resolveRole } from "@/lib/assess/roles";

export const maxDuration = 60; // a brand-new role needs one model call

const Body = z.object({ text: z.string().min(1).max(400) }).strict();

/**
 * Free text in, candidate roles out. Never saves a choice: the student confirms one with /role/confirm.
 * A second, tighter limit applies because an unmatched role costs a model call.
 */
export const POST = assessRoute("assess_role_resolve", 12, async (req, { userId, db }) => {
  const { text } = await readJson(req, Body);
  const outcome = await resolveRole(db, text);
  void track(db, userId, "career_role_entered", { status: outcome.status, length: text.length });
  return outcome;
});
