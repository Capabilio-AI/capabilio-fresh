import { NextResponse } from "next/server";
import { z } from "zod";
import { viewerRoute } from "@/lib/api/viewer-route";
import { SIM_TEST_KEYS } from "@/lib/crt/categories";
import { coachReply, gradeSet, simulatorSet, speakingFeedback } from "@/lib/crt/studio-server";
import { saveAnswers, startOrResume, submitAttempt, type Outcome } from "@/lib/crt/server";

const id = z.string().uuid();
const test = z.enum(SIM_TEST_KEYS);
const answers = z.record(z.string().uuid(), z.string().min(1).max(8)).default({});

// One endpoint for the whole student flow, so the browser only ever talks to one authenticated, strictly-parsed door.
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), cycleId: id }).strict(),
  z.object({ action: z.literal("save"), attemptId: id, answers }).strict(),
  z.object({ action: z.literal("submit"), attemptId: id, answers }).strict(),
  z.object({ action: z.literal("simulator"), test }).strict(),
  z.object({ action: z.literal("grade"), test, answers: z.record(z.string().uuid(), z.string().min(1).max(8)) }).strict(),
  z.object({ action: z.literal("coach"), questionId: id, chosenKey: z.string().min(1).max(8).optional(), ask: z.string().max(500).optional() }).strict(),
  z.object({ action: z.literal("speak"), promptKey: z.string().min(1).max(40), transcript: z.string().min(1).max(4000), seconds: z.number().int().min(1).max(900).optional() }).strict(),
]);

const respond = <T extends Record<string, unknown>>(out: Outcome<T>) => {
  if (out.ok) {
    const { ok: _ok, ...rest } = out;
    return rest;
  }
  return NextResponse.json({ error: out.error }, { status: out.status });
};

export async function POST(request: Request) {
  return viewerRoute(request, Body, async ({ userId, service }, body) => {
    switch (body.action) {
      case "start":
        return respond(await startOrResume(service, userId, body.cycleId));
      case "save":
        return respond(await saveAnswers(service, userId, body.attemptId, body.answers));
      case "submit":
        return respond(await submitAttempt(service, userId, body.attemptId, body.answers));
      case "simulator":
        return respond(await simulatorSet(service, userId, body.test));
      case "grade":
        return respond(await gradeSet(service, userId, body));
      case "coach":
        return respond(await coachReply(service, userId, body));
      case "speak":
        return respond(await speakingFeedback(service, userId, body));
    }
  });
}
