import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { notify } from "@/lib/notifications/notify";
import { matchPathways, type PathwayCandidate } from "./match";

export interface OpenRequest { id: string; user_id: string; goal_text: string }

/** Pure. The open requests a newly published pathway answers: what the student typed names the pathway by its name or an alias, exactly as in the goal box. */
export function requestsCoveredBy(requests: readonly OpenRequest[], pathway: PathwayCandidate): OpenRequest[] {
  return requests.filter((r) => matchPathways(r.goal_text, [pathway]).length > 0);
}

/**
 * A pathway was published: mark the open goal requests it answers as covered, and tell each student once. Best effort: it never throws, because publishing
 * must not fail on a notification. Returns how many requests were covered and how many students were told.
 */
export async function coverRequests(service: SupabaseClient, pathway: PathwayCandidate): Promise<{ covered: number; notified: number }> {
  try {
    const db = untyped(service);
    const { data, error } = await db.from("goal_requests").select("id, user_id, goal_text").eq("status", "OPEN").limit(20000);
    if (error) throw error;
    const hit = requestsCoveredBy((data ?? []) as OpenRequest[], pathway);
    if (hit.length === 0) return { covered: 0, notified: 0 };
    const { error: upErr } = await db.from("goal_requests").update({ status: "COVERED", covered_by_pathway_key: pathway.key }).in("id", hit.map((r) => r.id));
    if (upErr) throw upErr;
    const notified = await notify(service as never, {
      userIds: hit.map((r) => r.user_id), type: "pathway_ready", title: `A route for ${pathway.name} is ready`,
      body: "Ways in, what to learn, where to start, and where to watch for notifications.", href: `/pathways/${pathway.key}`, dedupeKey: `pathway:${pathway.key}`,
    });
    return { covered: hit.length, notified };
  } catch (e) {
    console.error("[goals] could not cover requests:", e instanceof Error ? e.message : e);
    return { covered: 0, notified: 0 };
  }
}
