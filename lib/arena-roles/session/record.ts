import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { logArenaEvent } from "@/lib/arena-workstations/log";
import { recordServerEvent } from "./service";
import { supabaseSessionStore } from "./supabase-store";

/** Pure. A stable id for a query so repeating the same one is recognised (whitespace and case do not make it new). The query text itself is never stored. */
export const sqlHash = (sql: string): string => createHash("sha256").update(sql.toLowerCase().replace(/\s+/g, " ").trim()).digest("hex").slice(0, 16);

/**
 * If this attempt is a Proof Session stage, records that the student ran a query (a trusted, server-side event). Never throws: the log is a record,
 * and a failure to write it must not break running a query.
 */
export async function recordQueryForAttempt(service: SupabaseClient<Database>, userId: string, attemptId: string, sql: string, ok: boolean): Promise<void> {
  try {
    const { data } = await untyped(service).from("arena_domain_assignments").select("proof_session_id").eq("id", attemptId).eq("user_id", userId).maybeSingle();
    const sessionId = (data as { proof_session_id: string | null } | null)?.proof_session_id;
    if (!sessionId) return;
    const store = supabaseSessionStore(service);
    const stage = (await store.stages(sessionId)).find((s) => s.assignmentId === attemptId);
    if (stage) await recordServerEvent(store, sessionId, { kind: "query_run", stageKey: stage.stageKey, source: "server", sqlHash: sqlHash(sql), ok });
  } catch (e) {
    logArenaEvent("session.record_failed", { userId, attemptId, reason: (e as Error).message.slice(0, 200) });
  }
}
