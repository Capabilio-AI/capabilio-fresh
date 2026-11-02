// Seals evidence records for tasks passed before sealing existed. Safe to re-run: sealed records are never overwritten.
// Usage: node --env-file=.env.local --import tsx scripts/backfill-evidence.mts [--dry-run]
import { createServiceClient } from "@/lib/supabase/service";
import { sealAttemptEvidence } from "@/lib/evidence/records";

const dry = process.argv.includes("--dry-run");
const db = createServiceClient() as any;
const { data: done } = await db.from("arena_attempt_completions").select("attempt_id");
const { data: have, error } = await db.from("evidence_records").select("attempt_id");
if (error) {
  console.error("evidence_records is not readable (is migration 153 applied?):", error.message);
  process.exit(1);
}
const sealed = new Set((have ?? []).map((r: { attempt_id: string }) => r.attempt_id));
const todo = (done ?? []).map((r: { attempt_id: string }) => r.attempt_id).filter((id: string) => !sealed.has(id));
console.log(`${done?.length ?? 0} passed tasks, ${sealed.size} already sealed, ${todo.length} to seal${dry ? " (dry run)" : ""}`);
if (!dry) for (const id of todo) await sealAttemptEvidence(db, id);
if (!dry) {
  const { data: after } = await db.from("evidence_records").select("attempt_id");
  console.log(`now sealed: ${after?.length ?? 0}`);
}
