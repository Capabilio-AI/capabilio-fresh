import { StoreConflict, type NewEvent, type SessionRow, type SessionStore, type StageRow } from "./store";

/** In-memory SessionStore for tests. Enforces the same rule as the database: one open session per student and role. */
export function memoryStore(opts: { openDailyTicket?: (userId: string, roleKey: string) => boolean } = {}): SessionStore & { sessions: SessionRow[]; allStages: StageRow[]; log: Map<string, unknown[]> } {
  const sessions: SessionRow[] = [];
  const allStages: StageRow[] = [];
  const log = new Map<string, unknown[]>();
  const reports = new Map<string, unknown>();
  let n = 0;
  return {
    sessions,
    allStages,
    log,
    async openSession(userId, roleKey) {
      return sessions.find((s) => s.userId === userId && s.roleKey === roleKey && s.status === "open") ?? null;
    },
    async hasOpenDailyTicket(userId, roleKey) {
      return opts.openDailyTicket?.(userId, roleKey) ?? false;
    },
    async createSession(input, stages) {
      if (sessions.some((s) => s.userId === input.userId && s.roleKey === input.roleKey && s.status === "open")) throw new StoreConflict("one open session");
      const row: SessionRow = { ...input, id: `s${++n}`, status: "open", startedAt: "2026-10-22T10:00:00Z", finishedAt: null };
      sessions.push(row);
      for (const st of stages) allStages.push({ sessionId: row.id, assignmentId: null, status: "pending", checksPassed: null, checksTotal: null, ...st });
      return row;
    },
    async session(userId, sessionId) {
      return sessions.find((s) => s.id === sessionId && s.userId === userId) ?? null;
    },
    async stages(sessionId) {
      return allStages.filter((s) => s.sessionId === sessionId).sort((a, b) => a.stageIndex - b.stageIndex);
    },
    async updateStage(sessionId, stageKey, patch) {
      const i = allStages.findIndex((s) => s.sessionId === sessionId && s.stageKey === stageKey);
      if (i >= 0) allStages[i] = { ...allStages[i], ...patch };
    },
    async appendEvent(sessionId, event: NewEvent) {
      const list = log.get(sessionId) ?? [];
      log.set(sessionId, [...list, { ...event, seq: list.length + 1, at: "2026-10-22T10:00:00Z" }]);
    },
    async events(sessionId) {
      return log.get(sessionId) ?? [];
    },
    async saveReport(sessionId, version, report) {
      reports.set(`${sessionId}:${version}`, report);
    },
    async report(sessionId, version) {
      return reports.get(`${sessionId}:${version}`) ?? null;
    },
    async closeSession(sessionId, status) {
      const i = sessions.findIndex((s) => s.id === sessionId);
      if (i >= 0) sessions[i] = { ...sessions[i], status, finishedAt: "2026-10-22T11:00:00Z" };
    },
  };
}
