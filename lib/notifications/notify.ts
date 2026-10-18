import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";

export interface NotifyInput {
  /** who is told; the same person is never notified of their own action */
  userIds: string[];
  type: string;
  title: string;
  body?: string;
  /** an in-app path ("/org/team"), never an external URL */
  href?: string;
  actorId?: string | null;
  institutionId?: string | null;
  /** with a key, the same person gets this notification once however many times the action repeats */
  dedupeKey?: string;
}

const CHUNK = 500;

/**
 * Best effort and never throws: a notification must not be able to break the action that caused it. Returns how many
 * rows were stored (0 on failure, which is logged).
 */
export async function notify(service: SupabaseClient<Database>, input: NotifyInput): Promise<number> {
  const ids = [...new Set(input.userIds)].filter((id) => id && id !== input.actorId);
  if (ids.length === 0) return 0;
  const db = untyped(service);
  let stored = 0;
  try {
    for (let i = 0; i < ids.length; i += CHUNK) {
      const rows = ids.slice(i, i + CHUNK).map((userId) => ({
        user_id: userId,
        type: input.type,
        title: input.title.slice(0, 200),
        body: input.body?.slice(0, 500) ?? null,
        href: input.href ?? null,
        actor_id: input.actorId ?? null,
        institution_id: input.institutionId ?? null,
        dedupe_key: input.dedupeKey ?? null,
      }));
      const { error, count } = await db.from("notifications").upsert(rows, { onConflict: "user_id,dedupe_key", ignoreDuplicates: true, count: "exact" });
      if (error) throw error;
      stored += count ?? rows.length;
    }
  } catch (e) {
    console.error(`[notify] ${input.type} failed:`, e instanceof Error ? e.message : e);
  }
  return stored;
}
