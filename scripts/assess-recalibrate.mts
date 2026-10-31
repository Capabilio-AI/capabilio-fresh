// Re-publishes every student's skill graph under the current scoring rules (run once after the proof-cap change, after migration 148).
//   npm run assess:recalibrate            (every student with a snapshot)
// Appends one RECALIBRATION snapshot per (student, career); scores come from the evidence ledger, so it is safe to re-run.
import { createServiceClient } from "@/lib/supabase/service";
import { syncSkillGraph } from "@/lib/assess/graph-sync";

const db = createServiceClient() as never;
const { data, error } = await (db as any).from("career_skill_graph_snapshots").select("student_id, career_id");
if (error) throw error;
const pairs = [...new Map((data as { student_id: string; career_id: string }[]).map((r) => [`${r.student_id}:${r.career_id}`, r])).values()];
let done = 0;
for (const p of pairs) {
  try {
    const out = await syncSkillGraph(db, p.student_id, p.career_id, "RECALIBRATION");
    console.log(`${p.student_id.slice(0, 8)} ${p.career_id.slice(0, 8)} -> readiness ${out?.readiness ?? "skipped"}`);
    done++;
  } catch (e) {
    console.log(`! ${p.student_id.slice(0, 8)}: ${(e as Error).message}`);
  }
}
console.log(`${done}/${pairs.length} recalibrated`);
