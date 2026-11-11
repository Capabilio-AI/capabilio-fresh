// Gives every active role that has a published roadmap but no skill profile the profile its roadmap implies, so it can be assessed, scored
// and matched to projects. Safe to re-run; a role that already has a profile is never touched.
//   npm run roles:requirements            dry run: lists what would be created, writes nothing
//   npm run roles:requirements -- --apply  creates the profiles
import { createServiceClient } from "@/lib/supabase/service";
import { ensureRequirements } from "@/lib/roadmap-generate/requirements";

const service = createServiceClient();
const apply = process.argv.includes("--apply");
const { data: careers, error } = await service.from("careers").select("id, name").eq("is_active", true).order("name");
if (error) throw error;

const rows: { role: string; skills: number; result: string }[] = [];
for (const c of careers ?? []) {
  try {
    const n = await ensureRequirements(service, c.id, { dryRun: !apply });
    if (n > 0) rows.push({ role: c.name, skills: n, result: apply ? "created" : "would create" });
  } catch (e) {
    rows.push({ role: c.name, skills: 0, result: `FAILED: ${e instanceof Error ? e.message : e}` });
  }
}
console.table(rows);
console.log(apply ? `${rows.filter((r) => r.result === "created").length} roles given a skill profile.` : `Dry run: ${rows.length} roles would get a skill profile. Re-run with --apply to create them.`);
