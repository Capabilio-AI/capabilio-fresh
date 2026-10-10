// Replays verified Domain passes into the shared ELO ledger / skill graph. Idempotent (the ledger is keyed per attempt), safe to re-run.
//   npm run arena:backfill-domain
import { createServiceClient } from "@/lib/supabase/service";
import { untyped } from "@/lib/org/db";
import { loadChallenge, loadOwnAttempt, propagateDomainPass } from "@/lib/arena-challenges/attempts";

const service = createServiceClient();
const { data } = await untyped(service).from("challenge_attempts").select("id, student_id, challenge_id, arena_challenges!inner ( track )").eq("status", "PASSED").eq("evidence_status", "VERIFIED_AUTOMATED").eq("arena_challenges.track", "domain");
const rows = (data ?? []) as { id: string; student_id: string; challenge_id: string }[];
for (const r of rows) {
  await propagateDomainPass(service, r.student_id, await loadOwnAttempt(service, r.student_id, r.id), await loadChallenge(service, r.challenge_id));
  console.log(`replayed ${r.id}`);
}
console.log(`${rows.length} verified domain pass(es) replayed`);
