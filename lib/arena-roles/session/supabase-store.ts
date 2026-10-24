import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { StoreConflict, type NewEvent, type SessionRow, type SessionStore, type StageRow } from "./store";

const UNIQUE_VIOLATION = "23505";
const SEQ_RETRIES = 25;

interface SessionDb { id: string; user_id: string; role_key: string; spec_key: string; spec_version: number; status: SessionRow["status"]; started_at: string; finished_at: string | null }
interface StageDb { session_id: string; stage_key: string; stage_index: number; area_key: string; assignment_id: string | null; status: StageRow["status"]; checks_passed: number | null; checks_total: number | null }
interface EventDb { seq: number; at: string; stage_key: string; kind: string; source: string; payload: Record<string, unknown> }

const toSession = (r: SessionDb): SessionRow => ({ id: r.id, userId: r.user_id, roleKey: r.role_key, specKey: r.spec_key, specVersion: r.spec_version, status: r.status, startedAt: r.started_at, finishedAt: r.finished_at });
const toStage = (r: StageDb): StageRow => ({ sessionId: r.session_id, stageKey: r.stage_key, stageIndex: r.stage_index, areaKey: r.area_key, assignmentId: r.assignment_id, status: r.status, checksPassed: r.checks_passed, checksTotal: r.checks_total });

/** The event's own fields (everything but the common columns) live in `payload`. */
const split = (event: NewEvent) => {
  const { stageKey, kind, source, ...payload } = event as { stageKey: string; kind: string; source: string } & Record<string, unknown>;
  return { stage_key: stageKey, kind, source, payload };
};

function fail(error: { message: string } | null, what: string): never | void {
  if (error) throw new Error(`${what}: ${error.message}`);
}

export function supabaseSessionStore(service: SupabaseClient<Database>): SessionStore {
  const db = untyped(service);
  return {
    async openSession(userId, roleKey) {
      const { data, error } = await db.from("arena_proof_sessions").select("*").eq("user_id", userId).eq("role_key", roleKey).eq("status", "open").maybeSingle();
      fail(error, "load open session");
      return data ? toSession(data as SessionDb) : null;
    },

    async hasOpenDailyTicket(userId, roleKey) {
      const { data, error } = await db.from("arena_domain_assignments").select("id").eq("user_id", userId).eq("role_key", roleKey).is("completed_at", null).is("proof_session_id", null).order("id").limit(1);
      fail(error, "check daily ticket");
      return (data?.length ?? 0) > 0;
    },

    async createSession(input, stages) {
      const { data, error } = await db.from("arena_proof_sessions").insert({ user_id: input.userId, role_key: input.roleKey, spec_key: input.specKey, spec_version: input.specVersion }).select("*").single();
      if (error?.code === UNIQUE_VIOLATION) throw new StoreConflict("a session is already open");
      fail(error, "create session");
      const session = toSession(data as SessionDb);
      const { error: stageError } = await db.from("arena_proof_session_stages").insert(stages.map((s) => ({ session_id: session.id, stage_key: s.stageKey, stage_index: s.stageIndex, area_key: s.areaKey })));
      if (stageError) {
        // sessions are never deleted; an unusable one is closed so the student can start again
        await db.from("arena_proof_sessions").update({ status: "abandoned", finished_at: new Date().toISOString() }).eq("id", session.id);
        throw new Error(`create stages: ${stageError.message}`);
      }
      return session;
    },

    async session(userId, sessionId) {
      const { data, error } = await db.from("arena_proof_sessions").select("*").eq("id", sessionId).eq("user_id", userId).maybeSingle();
      fail(error, "load session");
      return data ? toSession(data as SessionDb) : null;
    },

    async stages(sessionId) {
      const { data, error } = await db.from("arena_proof_session_stages").select("*").eq("session_id", sessionId).order("stage_index");
      fail(error, "load stages");
      return ((data ?? []) as StageDb[]).map(toStage);
    },

    async updateStage(sessionId, stageKey, patch) {
      const row: Record<string, unknown> = {};
      if (patch.assignmentId !== undefined) row.assignment_id = patch.assignmentId;
      if (patch.status !== undefined) row.status = patch.status;
      if (patch.checksPassed !== undefined) row.checks_passed = patch.checksPassed;
      if (patch.checksTotal !== undefined) row.checks_total = patch.checksTotal;
      if (Object.keys(row).length === 0) return;
      const { error } = await db.from("arena_proof_session_stages").update(row).eq("session_id", sessionId).eq("stage_key", stageKey);
      fail(error, "update stage");
    },

    async appendEvent(sessionId, event) {
      const row = split(event);
      // The next number is read, then claimed by the primary key. When writers collide the loser reads again; a short random wait stops them colliding
      // again in step. Events come one at a time from a single student, so this is only ever a few tries.
      for (let attempt = 0; attempt < SEQ_RETRIES; attempt++) {
        const { data: last } = await db.from("arena_session_events").select("seq").eq("session_id", sessionId).order("seq", { ascending: false }).limit(1);
        const seq = ((last?.[0] as { seq: number } | undefined)?.seq ?? 0) + 1;
        const { error } = await db.from("arena_session_events").insert({ session_id: sessionId, seq, ...row });
        if (!error) return;
        if (error.code !== UNIQUE_VIOLATION) fail(error, "append event");
        await new Promise((resolve) => setTimeout(resolve, Math.random() * 40 * (attempt + 1)));
      }
      throw new Error("append event: could not allocate a sequence number");
    },

    async events(sessionId) {
      const { data, error } = await db.from("arena_session_events").select("seq, at, stage_key, kind, source, payload").eq("session_id", sessionId).order("seq");
      fail(error, "load events");
      return ((data ?? []) as EventDb[]).map((r) => ({ ...r.payload, seq: r.seq, at: r.at, stageKey: r.stage_key, kind: r.kind, source: r.source }));
    },

    async saveReport(sessionId, rubricVersion, report) {
      const { error } = await db.from("arena_session_reports").insert({ session_id: sessionId, rubric_version: rubricVersion, report });
      if (error && error.code !== UNIQUE_VIOLATION) fail(error, "save report");
    },

    async report(sessionId, rubricVersion) {
      const { data, error } = await db.from("arena_session_reports").select("report").eq("session_id", sessionId).eq("rubric_version", rubricVersion).maybeSingle();
      fail(error, "load report");
      return (data as { report: unknown } | null)?.report ?? null;
    },

    async closeSession(sessionId, status) {
      const { error } = await db.from("arena_proof_sessions").update({ status, finished_at: new Date().toISOString() }).eq("id", sessionId).eq("status", "open");
      fail(error, "close session");
    },
  };
}
