import { z } from "zod";
import { assessRoute, readJson } from "@/lib/assess/http";
import { startSession } from "@/lib/assess/session";

export const maxDuration = 60; // the first questions may need one bounded live Groq call on a cold pool

const Body = z.object({ layer: z.enum(["GENERAL", "CAREER"]), careerId: z.string().uuid().optional() });

/** Creates (or resumes) the student's session and prepares its first question. The career defaults to the confirmed primary one; a body may only name the student's own Plan B. */
export const POST = assessRoute("assess_start", 20, async (req, { userId, db }) => {
  const { layer, careerId } = await readJson(req, Body);
  return startSession(db, userId, layer, { careerId });
});
