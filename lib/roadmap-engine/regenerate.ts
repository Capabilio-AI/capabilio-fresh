import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { ensureRoadmap } from "./service";
import type { ExplainFn } from "./explain";

type Service = SupabaseClient<Database>;

export interface RegenerationReport {
  considered: number;
  regenerated: number;
  unchanged: number;
  /** students whose roadmap cannot be built yet (no year, no goal, …) — nothing was written for them */
  notReady: number;
  failed: number;
  /** students left unprocessed because the cap or deadline was reached */
  remaining: number;
}

const DEFAULT_CAP = 500;
const CONCURRENCY = 3;

/**
 * After a curriculum is published: bring the roadmaps of that branch's students — those who have set a career goal (or are exploring) — up to
 * date. Bounded (a cap and a deadline), concurrent, idempotent (ensureRoadmap writes nothing for a student whose inputs did not change), and one
 * student's failure never stops the others. Returns what happened; run it from a background job, never inside the publish request itself.
 */
export async function regenerateForBranch(service: Service, institutionId: string, branchKey: string, opts: { cap?: number; deadlineMs?: number; explain?: ExplainFn | false; now?: Date } = {}): Promise<RegenerationReport> {
  const db = untyped(service);
  const { data: members } = await db.from("institution_memberships").select("user_id, branch").eq("institution_id", institutionId).eq("role", "student").eq("status", "active");
  const userIds = [...new Set(((members ?? []) as { user_id: string; branch: string | null }[]).filter((m) => m.branch && m.branch.trim().toLowerCase() === branchKey).map((m) => m.user_id))];
  const { data: intents } = userIds.length ? await db.from("student_career_intent").select("student_id, primary_career_id, is_exploring").in("student_id", userIds) : { data: [] };
  const targets = ((intents ?? []) as { student_id: string; primary_career_id: string | null; is_exploring: boolean }[]).filter((i) => i.primary_career_id || i.is_exploring).map((i) => i.student_id).sort();

  const cap = opts.cap ?? DEFAULT_CAP;
  const deadline = Date.now() + (opts.deadlineMs ?? 240_000);
  const report: RegenerationReport = { considered: Math.min(targets.length, cap), regenerated: 0, unchanged: 0, notReady: 0, failed: 0, remaining: Math.max(0, targets.length - cap) };
  const queue = targets.slice(0, cap);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(CONCURRENCY, queue.length) }, async () => {
      while (next < queue.length) {
        if (Date.now() > deadline) { report.remaining += queue.length - next; next = queue.length; return; }
        const userId = queue[next++];
        try {
          const r = await ensureRoadmap(service, userId, { explain: opts.explain, now: opts.now });
          if (r.status !== "READY") report.notReady++;
          else if (r.created) report.regenerated++;
          else report.unchanged++;
        } catch (error) {
          report.failed++;
          console.error("[roadmap-regeneration] failed for one student:", error instanceof Error ? error.message : error);
        }
      }
    })
  );
  return report;
}
