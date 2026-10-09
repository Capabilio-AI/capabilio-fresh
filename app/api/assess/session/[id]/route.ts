import { z } from "zod";
import { assessRoute } from "@/lib/assess/http";
import { getState } from "@/lib/assess/session";

const Id = z.string().uuid();

/** Resume point after a refresh: the current question, and its locked feedback if it was already answered. */
export const GET = assessRoute<{ id: string }>("assess_state", 120, async (_req, { userId, db, params }) => getState(db, userId, Id.parse(params.id)), { memoryLimit: true });
