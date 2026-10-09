import { z } from "zod";
import { assessRoute, readJson } from "@/lib/assess/http";
import { reviewProofOfWork } from "@/lib/assess/proof";
import { isPlatformAdmin } from "@/lib/arena-content/store";
import { AssessError } from "@/lib/assess/types";
import type { createServiceClient } from "@/lib/supabase/service";

const Body = z.object({ decision: z.enum(["VERIFIED", "REJECTED"]) }).strict();

/** Verification is a reviewer action (platform admin for now); students cannot verify their own proof. */
export const POST = assessRoute<{ id: string }>("proof_review", 60, async (req, { userId, db, params }) => {
  if (!(await isPlatformAdmin(db as unknown as ReturnType<typeof createServiceClient>, userId))) throw new AssessError("FORBIDDEN", "Only a reviewer can verify proof of work.", 403);
  const { decision } = await readJson(req, Body);
  return { item: await reviewProofOfWork(db, z.string().uuid().parse(params.id), userId, decision) };
});
