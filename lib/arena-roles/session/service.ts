import type { ExperienceLevel } from "@/lib/workplace/level";
import { DATA_ANALYST_STORY, type ProofSessionSpec, type SessionStage } from "../sessions/data-analyst-story";
import { BACKEND_SERVICE } from "../sessions/backend-developer-service";
import { parseEvents } from "./events";
import { buildReport, type SessionReport, type StageResult } from "./report";
import { StoreConflict, type NewEvent, type SessionRow, type SessionStore, type StageRow } from "./store";

export const RUBRIC_VERSION = "signals.v1";

/** The session spec each role runs. A role without an entry has no Proof Session: nothing is substituted. */
export const SPECS: Readonly<Record<string, ProofSessionSpec>> = { "data-analyst": DATA_ANALYST_STORY, "backend-developer": BACKEND_SERVICE };

export class SessionError extends Error {
  constructor(message: string, readonly status: number, readonly reason: string) {
    super(message);
  }
}

/** Client-reported events a browser may send. Server events (queries, checks, AI, submits) are written only by our own routes. */
export const CLIENT_EVENT_KINDS = ["brief_viewed", "data_inspected", "plan_note"] as const;

export interface SessionView {
  session: SessionRow;
  stages: (StageRow & { title: string; goal: string })[];
  /** the stage to work on now, or null when every stage is passed */
  current: string | null;
}

const describe = (spec: ProofSessionSpec, level: ExperienceLevel, stages: StageRow[]): SessionView["stages"] => {
  const byKey = new Map(spec.stagesFor(level).map((s) => [s.key, s]));
  return stages.map((s) => ({ ...s, title: byKey.get(s.stageKey)?.title ?? s.stageKey, goal: byKey.get(s.stageKey)?.goal ?? "" }));
};

/** Pure. The first stage that is not passed; stages are worked strictly in order. */
export const currentStage = (stages: Pick<StageRow, "stageKey" | "stageIndex" | "status">[]): string | null =>
  [...stages].sort((a, b) => a.stageIndex - b.stageIndex).find((s) => s.status !== "passed")?.stageKey ?? null;

async function view(store: SessionStore, spec: ProofSessionSpec, level: ExperienceLevel, session: SessionRow): Promise<SessionView> {
  const stages = await store.stages(session.id);
  return { session, stages: describe(spec, level, stages), current: currentStage(stages) };
}

const specFor = (roleKey: string): ProofSessionSpec => {
  const spec = SPECS[roleKey];
  if (!spec) throw new SessionError("There is no Proof Session for this role yet.", 404, "no_session_for_role");
  return spec;
};

/** Starts a session, or returns the one already open (a repeated request never creates a second). Refuses while a daily ticket is open. */
export async function startSession(store: SessionStore, input: { userId: string; roleKey: string; level: ExperienceLevel }): Promise<SessionView> {
  const spec = specFor(input.roleKey);
  const existing = await store.openSession(input.userId, input.roleKey);
  if (existing) return view(store, spec, input.level, existing);
  if (await store.hasOpenDailyTicket(input.userId, input.roleKey)) throw new SessionError("Finish or close your open daily ticket before starting a Proof Session.", 409, "daily_ticket_open");

  const stages = spec.stagesFor(input.level);
  try {
    const session = await store.createSession({ userId: input.userId, roleKey: input.roleKey, specKey: spec.key, specVersion: spec.version }, stages.map((s: SessionStage, i) => ({ stageKey: s.key, stageIndex: i, areaKey: s.areaKey })));
    return view(store, spec, input.level, session);
  } catch (e) {
    // two requests raced: the other one won, so return its session
    if (e instanceof StoreConflict) {
      const winner = await store.openSession(input.userId, input.roleKey);
      if (winner) return view(store, spec, input.level, winner);
    }
    throw e;
  }
}

/** The student's open session, or null. */
export async function currentSession(store: SessionStore, input: { userId: string; roleKey: string; level: ExperienceLevel }): Promise<SessionView | null> {
  const spec = specFor(input.roleKey);
  const open = await store.openSession(input.userId, input.roleKey);
  return open ? view(store, spec, input.level, open) : null;
}

async function owned(store: SessionStore, userId: string, sessionId: string): Promise<SessionRow> {
  const session = await store.session(userId, sessionId);
  if (!session) throw new SessionError("Session not found.", 404, "not_found");
  return session;
}

/** Records something the browser reported. Only the whitelisted kinds, only on the stage the student is on, only while the session is open. */
export async function recordClientEvent(store: SessionStore, input: { userId: string; sessionId: string; event: unknown }): Promise<void> {
  const session = await owned(store, input.userId, input.sessionId);
  if (session.status !== "open") throw new SessionError("This session is closed.", 409, "closed");
  const e = input.event as { kind?: unknown; target?: unknown; words?: unknown };
  const kind = (CLIENT_EVENT_KINDS as readonly unknown[]).includes(e?.kind) ? (e.kind as (typeof CLIENT_EVENT_KINDS)[number]) : null;
  if (!kind) throw new SessionError("That event cannot be reported by the browser.", 400, "bad_event");
  const stageKey = currentStage(await store.stages(session.id));
  if (!stageKey) throw new SessionError("Every stage is already passed.", 409, "no_stage");

  const base = { stageKey, source: "client" as const };
  let event: NewEvent;
  if (kind === "brief_viewed") event = { ...base, kind };
  else if (kind === "data_inspected") {
    if (typeof e.target !== "string" || e.target.trim().length === 0 || e.target.length > 120) throw new SessionError("A target is required.", 400, "bad_event");
    event = { ...base, kind, target: e.target.trim() };
  } else {
    if (!Number.isInteger(e.words) || (e.words as number) < 0 || (e.words as number) > 5000) throw new SessionError("A word count is required.", 400, "bad_event");
    event = { ...base, kind, words: e.words as number };
  }
  await store.appendEvent(session.id, event);
}

/** Called by our own routes after they ran a query, a check, an AI exchange or a submit. These are the trusted events. */
export async function recordServerEvent(store: SessionStore, sessionId: string, event: NewEvent): Promise<void> {
  await store.appendEvent(sessionId, { ...event, source: "server" } as NewEvent);
}

/** Records a graded submission for the stage, from the server's own grading result. The log can never change this. */
export async function recordStageResult(store: SessionStore, input: { sessionId: string; stageKey: string; passed: boolean; checksPassed: number; checksTotal: number }): Promise<void> {
  const total = Math.max(1, input.checksTotal);
  await recordServerEvent(store, input.sessionId, { kind: "check_run", stageKey: input.stageKey, source: "server", passed: Math.min(input.checksPassed, total), total });
  await recordServerEvent(store, input.sessionId, { kind: "submitted", stageKey: input.stageKey, source: "server", passed: input.passed });
  await store.updateStage(input.sessionId, input.stageKey, { status: input.passed ? "passed" : "active", checksPassed: input.checksPassed, checksTotal: total });
}

/** Builds and stores the report once every stage is passed. Idempotent: a second call returns the stored report. */
export async function finalizeReport(store: SessionStore, input: { userId: string; sessionId: string; level: ExperienceLevel }): Promise<SessionReport> {
  const session = await owned(store, input.userId, input.sessionId);
  const spec = specFor(session.roleKey);
  const stored = await store.report(session.id, RUBRIC_VERSION);
  if (stored) return stored as SessionReport;

  const stages = describe(spec, input.level, await store.stages(session.id));
  const explorable = new Set(spec.stagesFor(input.level).filter((s) => s.explorable).map((s) => s.key));
  const results: StageResult[] = stages.map((s) => ({ key: s.stageKey, title: s.title, passed: s.status === "passed", checksPassed: s.checksPassed ?? 0, checksTotal: s.checksTotal ?? 0, explorable: explorable.has(s.stageKey) }));
  const { events, dropped } = parseEvents(await store.events(session.id));
  const report = buildReport({ specKey: spec.key, specVersion: spec.version, roleId: spec.roleId, claimSubject: spec.claimSubject, stages: results, events, limitations: spec.limitations, droppedEvents: dropped });
  await store.saveReport(session.id, RUBRIC_VERSION, report);
  return report;
}
