// Pre-builds profiles for roles students commonly ask for, so picking one is instant (no model call at pick time).
// Usage: npm run assess:roles. Safe to re-run: a role that already resolves is left alone.
import { createServiceClient } from "@/lib/supabase/service";
import { resolveRole } from "@/lib/assess/roles";

const ROLES = ["Data Engineer", "MLOps Engineer", "Generative AI Engineer", "Mobile App Developer", "Game Developer", "QA Automation Engineer", "Cloud Security Engineer", "Embedded Systems Engineer"];
const db = createServiceClient() as never;
for (const name of ROLES) {
  try {
    const out = await resolveRole(db, name);
    console.log(name.padEnd(26), out.status === "REJECTED" ? `REJECTED: ${out.message}` : `${out.status} -> ${out.primary.name} (${out.primary.skills.length} skills)`);
  } catch (e) {
    console.log(name.padEnd(26), "FAILED:", (e as Error).message);
  }
}
