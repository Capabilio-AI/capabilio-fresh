// Offline evaluation of role intelligence against the REAL model, with no database access and nothing persisted: for each title it prints what was understood,
// whether the student would be asked to clarify, and the reviewed framework. Run: node --env-file=.env.local --import tsx scripts/role-framework-eval.mts "Automobile Engineer" ...
import { writeFileSync } from "node:fs";
import { buildFramework, identifyRole, FrameworkUnavailable } from "@/lib/assess/role-framework";
import { checkRoleInput } from "@/lib/assess/role-input";

const titles = process.argv.slice(2);
const out: unknown[] = [];
for (const raw of titles) {
  const checked = checkRoleInput(raw);
  if (!checked.ok) { console.log(`\n## ${raw}\nREJECTED before the model: ${checked.message}`); continue; }
  const started = Date.now();
  const { identity } = await identifyRole(checked.text, []);
  console.log(`\n## ${raw}\nidentity: ${identity.canonicalTitle} | ${identity.industry} / ${identity.domain} | confidence ${identity.roleConfidence} | valid ${identity.isValidRole}`);
  if (!identity.isValidRole) { console.log("REJECTED:", identity.rejectReason); continue; }
  const targets = identity.specializationsNeeded && identity.specializations.length >= 2 ? identity.specializations.slice(0, 1).map((s) => s.title) : [identity.canonicalTitle];
  if (identity.specializationsNeeded) console.log("would ask the student to choose:", identity.specializations.map((s) => s.title).join(" | "));
  for (const title of targets) {
    try {
      const b = await buildFramework(title, { industry: identity.industry, domain: identity.domain, specializationOf: title === identity.canonicalTitle ? undefined : identity.canonicalTitle });
      console.log(`framework for "${title}": verified=${b.verified} attempts=${b.attempts} competencyConfidence=${b.gate.competencyConfidence} kept=${b.gate.skills.length} dropped=${b.gate.dropped.length} (${((Date.now() - started) / 1000).toFixed(0)}s)`);
      for (const s of b.gate.skills) console.log(`  ${s.tier.padEnd(10)} ${s.name.padEnd(36)} ${s.assessmentType.padEnd(12)} rel ${s.relevance}`);
      if (b.gate.dropped.length) console.log("  dropped:", b.gate.dropped.map((d) => `${d.name} (${d.reason})`).join("; "));
      if (b.gate.missingCoreSkills.length) console.log("  reviewer says missing:", b.gate.missingCoreSkills.join(", "));
      out.push({ raw, identity, title, verified: b.verified, confidence: b.gate.competencyConfidence, skills: b.gate.skills.map((s) => ({ name: s.name, tier: s.tier, assessmentType: s.assessmentType })), dropped: b.gate.dropped, missing: b.gate.missingCoreSkills });
    } catch (e) {
      console.log(`framework for "${title}": ${e instanceof FrameworkUnavailable ? `REFUSED (${e.reasons.join("; ")})` : `ERROR ${(e as Error).message}`}`);
      out.push({ raw, identity, title, error: (e as Error).message });
    }
  }
}
if (process.env.EVAL_OUT) writeFileSync(process.env.EVAL_OUT, JSON.stringify(out, null, 1));
