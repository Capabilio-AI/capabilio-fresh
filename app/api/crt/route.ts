import { NextResponse } from "next/server";
import { z } from "zod";
import { viewerRoute } from "@/lib/api/viewer-route";
import { completeSession, openSession, saveAnswers, startOrResume, submitAttempt, type Outcome } from "@/lib/crt/server";

const id = z.string().uuid();
const answers = z.record(z.string().uuid(), z.string().min(1).max(8)).default({});

// One endpoint for the whole student flow, so the browser only ever talks to one authenticated, strictly-parsed door.
const Body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("start"), cycleId: id }).strict(),
  z.object({ action: z.literal("save"), attemptId: id, answers }).strict(),
  z.object({ action: z.literal("submit"), attemptId: id, answers }).strict(),
  z.object({ action: z.literal("session"), sessionId: id }).strict(),
  z.object({ action: z.literal("complete"), sessionId: id }).strict(),
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
      case "session":
        return respond(await openSession(service, userId, body.sessionId));
      case "complete":
        return respond(await completeSession(service, userId, body.sessionId));
    }
  });
}
