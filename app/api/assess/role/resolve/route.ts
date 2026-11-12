import { z } from "zod";
import { assessRoute, readJson } from "@/lib/assess/http";
import { track } from "@/lib/assess/db";
import { resolveRole } from "@/lib/assess/roles";

export const maxDuration = 120; // a brand-new role needs three model calls: identify, draft, review (and a second draft if the review rejects the first)

const Choice = z.discriminatedUnion("kind", [
  z.object({ kind: z.literal("existing"), careerId: z.string().uuid() }).strict(),
  z.object({ kind: z.literal("specialization"), title: z.string().min(3).max(60), parent: z.string().max(60), industry: z.string().max(60), domain: z.string().max(60) }).strict(),
  z.object({ kind: z.literal("as_typed"), title: z.string().min(2).max(60), industry: z.string().max(60), domain: z.string().max(60) }).strict(),
]);
const Body = z.object({ text: z.string().min(1).max(400), choice: Choice.optional() }).strict();

/**
 * Free text in, candidate roles out. Never saves a choice: the student confirms one with /role/confirm.
 * A second, tighter limit applies because an unmatched role costs a model call.
 */
export const POST = assessRoute("assess_role_resolve", 12, async (req, { userId, db }) => {
  const { text, choice } = await readJson(req, Body);
  const outcome = await resolveRole(db, text, {}, choice);
  void track(db, userId, "career_role_entered", { status: outcome.status, length: text.length, clarified: choice?.kind ?? null });
  return outcome;
});
