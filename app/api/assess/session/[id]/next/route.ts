import { z } from "zod";
import { assessRoute } from "@/lib/assess/http";
import { nextQuestion } from "@/lib/assess/session";

export const maxDuration = 60;
const Id = z.string().uuid();

export const POST = assessRoute<{ id: string }>("assess_next", 120, async (_req, { userId, db, params }) => nextQuestion(db, userId, Id.parse(params.id)), { memoryLimit: true });
