import type { SessionEvent } from "./events";

export type SessionStatus = "open" | "finished" | "abandoned";
export type StageStatus = "pending" | "active" | "passed" | "failed";

export interface SessionRow {
  id: string;
  userId: string;
  roleKey: string;
  specKey: string;
  specVersion: number;
  status: SessionStatus;
  startedAt: string;
  finishedAt: string | null;
}

export interface StageRow {
  sessionId: string;
  stageKey: string;
  stageIndex: number;
  areaKey: string;
  /** the ordinary workstation attempt serving this stage */
  assignmentId: string | null;
  status: StageStatus;
  checksPassed: number | null;
  checksTotal: number | null;
}

/** An event as the caller supplies it; the store assigns `seq` and `at`. */
export type NewEvent = SessionEvent extends infer E ? (E extends SessionEvent ? Omit<E, "seq" | "at"> : never) : never;

/** Thrown by a store when a uniqueness rule (one open session per student and role) rejects a write. */
export class StoreConflict extends Error {}

/**
 * Everything the session service needs from storage. Every read that takes a userId is scoped to that student: a session is never returned to anyone
 * else. The Supabase implementation lives in supabase-store.ts; tests use an in-memory one.
 */
export interface SessionStore {
  openSession(userId: string, roleKey: string): Promise<SessionRow | null>;
  /** an open ordinary (daily) ticket for this student and role */
  hasOpenDailyTicket(userId: string, roleKey: string): Promise<boolean>;
  createSession(session: Omit<SessionRow, "id" | "startedAt" | "finishedAt" | "status">, stages: Pick<StageRow, "stageKey" | "stageIndex" | "areaKey">[]): Promise<SessionRow>;
  session(userId: string, sessionId: string): Promise<SessionRow | null>;
  stages(sessionId: string): Promise<StageRow[]>;
  updateStage(sessionId: string, stageKey: string, patch: Partial<Pick<StageRow, "assignmentId" | "status" | "checksPassed" | "checksTotal">>): Promise<void>;
  appendEvent(sessionId: string, event: NewEvent): Promise<void>;
  events(sessionId: string): Promise<unknown[]>;
  saveReport(sessionId: string, rubricVersion: string, report: unknown): Promise<void>;
  report(sessionId: string, rubricVersion: string): Promise<unknown | null>;
  closeSession(sessionId: string, status: Exclude<SessionStatus, "open">): Promise<void>;
}
