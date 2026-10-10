// Replays verified Domain passes into the shared ELO ledger / skill graph and tops up any pass the ledger under-credited (the ledger must move
// by exactly the ELO the ticket showed). Idempotent: each top-up has a fixed id, so re-running changes nothing.
//   npm run arena:backfill-domain
import { createHash } from "node:crypto";
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { loadChallenge, loadOwnAttempt, propagateDomainPass } from "@/lib/arena-challenges/attempts";
import { syncSkillGraph } from "@/lib/assess/graph-sync";
import type { Db } from "@/lib/assess/db";

const uuidFrom = (s: string) => { const h = createHash("sha1").update(s).digest("hex"); return `${h.slice(0, 8)}-${h.slice(8, 12)}-5${h.slice(13, 16)}-a${h.slice(17, 20)}-${h.slice(20, 32)}`; };

const service = createServiceClient();
const db = untyped(service);
const { data } = await db.from("challenge_attempts").select("id, student_id, challenge_id, elo_delta, arena_challenges!inner ( track )").eq("status", "PASSED").eq("evidence_status", "VERIFIED_AUTOMATED").eq("arena_challenges.track", "domain");
const rows = (data ?? []) as { id: string; student_id: string; challenge_id: string; elo_delta: number }[];
for (const r of rows) {
  await propagateDomainPass(service, r.student_id, await loadOwnAttempt(service, r.student_id, r.id), await loadChallenge(service, r.challenge_id), r.elo_delta);
  const { data: ev } = await db.from("elo_events").select("career_id, change").eq("source", "ARENA").eq("source_id", r.id).maybeSingle();
  const short = ev ? r.elo_delta - (ev as { change: number }).change : 0;
  if (ev && short > 0) {
    const careerId = (ev as { career_id: string }).career_id;
    await db.rpc("apply_elo_event", { p_student: r.student_id, p_career: careerId, p_source: "ARENA", p_source_id: uuidFrom(`${r.id}:topup`), p_correct: true, p_reason: "Arena pass top-up to the ticket's ELO", p_scale: short / 4 });
    await syncSkillGraph(db as unknown as Db, r.student_id, careerId, "ARENA");
    console.log(`topped up ${r.id} by +${short}`);
  }
}
console.log(`${rows.length} verified domain pass(es) checked`);
