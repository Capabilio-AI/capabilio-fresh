// Fills the shared assessment question pool from Groq. Usage:
//   npm run assess:pool -- data-analyst            (one career, all its skills)
//   npm run assess:pool -- data-analyst SQL POWER_BI   (only these skills)
//   npm run assess:pool -- --general               (the six general sections)
//   npm run assess:pool -- --all                   (every active career)
// Safe to re-run: only the missing questions per skill and difficulty are generated.
import { createServiceClient } from "@/lib/supabase/service";
import { loadCareerSkills } from "@/lib/assess/db";
import { warmPool } from "@/lib/assess/pool";

const db = createServiceClient() as never;
const args = process.argv.slice(2);

function print(label: string, reports: Awaited<ReturnType<typeof warmPool>>) {
  const ins = reports.reduce((a, r) => a + r.inserted, 0);
  const rej = reports.reduce((a, r) => a + r.rejected, 0);
  const err = reports.filter((r) => r.error);
  console.log(`${label}: +${ins} stored, ${rej} rejected by validation, ${err.length} failed calls`);
  for (const e of err) console.log(`   ! ${e.slot}/${e.difficulty}: ${e.error}`);
}

if (args[0] === "--general") {
  print("general", await warmPool(db, { general: true }));
} else {
  const { data: careers } = await (db as any).from("careers").select("id, key, name").eq("is_active", true);
  const wanted = args[0] === "--all" ? careers : careers.filter((c: { key: string }) => c.key === args[0]);
  if (wanted.length === 0) throw new Error(`No such career: ${args[0]}`);
  const only = args[0] === "--all" ? [] : args.slice(1).map((s) => `SKILL_${s.toUpperCase()}`);
  for (const career of wanted) {
    const all = await loadCareerSkills(db, career.id);
    const skills = only.length ? all.filter((s) => only.includes(s.key)) : all;
    print(career.name, await warmPool(db, { career, skills }, {}, 400));
  }
}
