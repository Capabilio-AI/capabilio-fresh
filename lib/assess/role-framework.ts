// Role intelligence, model side: identify what job was meant, draft its entry-level competency framework, have an independent pass review it, and apply the
// verdict with deterministic rules. Nothing here touches the database, so the whole pipeline can be evaluated offline against real models (see
// scripts/role-framework-eval.mts) and tested with a scripted model. Every outcome records how sure we are and what has NOT been verified.

import { generateStructured, type GenerateDeps } from "@/lib/ai/llm";
import { ROLE_IDENTIFY_PROMPT_VERSION, RoleIdentifySchema, roleIdentifyPrompt, type RoleIdentity } from "@/lib/ai/llm/prompts/role-identify.v1";
import { ROLE_FRAMEWORK_PROMPT_VERSION, RoleFrameworkSchema, roleFrameworkPrompt, type RoleFramework } from "@/lib/ai/llm/prompts/role-framework.v2";
import { ROLE_CRITIC_PROMPT_VERSION, RoleCriticSchema, roleCriticPrompt, type RoleCritique } from "@/lib/ai/llm/prompts/role-critic.v1";
import { applyCritique, type GateResult } from "./framework-validate";

export const FRAMEWORK_ATTEMPTS = 2;
/** After this long a sound first draft is accepted as it is: the optional completeness retry would make the student wait too long. */
export const COMPLETENESS_RETRY_BUDGET_MS = 30_000;
/** A first draft the reviewer accepts but says is missing this many important entry-level skills is drafted once more with those skills named. */
export const MISSING_RETRY_AT = 3;
export type { RoleIdentity };

export async function identifyRole(text: string, existing: string[], deps: GenerateDeps = {}): Promise<{ identity: RoleIdentity; provider: string; model: string }> {
  const { system, user } = roleIdentifyPrompt(text, existing);
  const out = await generateStructured({ task: "role_resolve", system, user, schema: RoleIdentifySchema, temperature: 0.1, maxTokens: 1200, promptVersion: ROLE_IDENTIFY_PROMPT_VERSION }, deps);
  return { identity: out.value, provider: out.provider, model: out.model };
}

export interface BuiltFramework {
  title: string;
  framework: RoleFramework;
  critique: RoleCritique;
  gate: GateResult;
  /** the strict gate passed on this attempt; false means usable but low confidence, flagged for a person to review */
  verified: boolean;
  attempts: number;
  provenance: { provider: string; model: string; promptVersions: string[] };
}

export class FrameworkUnavailable extends Error {
  constructor(message: string, readonly reasons: string[] = []) {
    super(message);
  }
}

/**
 * Draft, review, gate; once more with the reviewer's objections if the first draft is rejected. An outage propagates as the model's own error (the caller
 * says "try again"); a framework that cannot be made trustworthy throws FrameworkUnavailable. Generic skills are never substituted.
 */
export async function buildFramework(title: string, ctx: { industry: string; domain: string; specializationOf?: string }, deps: GenerateDeps = {}): Promise<BuiltFramework> {
  const startedAt = Date.now();
  let feedback: string[] | undefined;
  type Draft = { framework: RoleFramework; critique: RoleCritique; gate: GateResult; provider: string; model: string };
  let best: Draft | null = null;
  let preferred: Draft | null = null;
  for (let attempt = 1; attempt <= FRAMEWORK_ATTEMPTS; attempt++) {
    const draft = roleFrameworkPrompt(title, ctx, feedback);
    const made = await generateStructured({ task: "role_profile", system: draft.system, user: draft.user, schema: RoleFrameworkSchema, temperature: attempt === 1 ? 0.2 : 0.35, maxTokens: 4200, promptVersion: ROLE_FRAMEWORK_PROMPT_VERSION }, deps);
    const review = roleCriticPrompt(title, ctx, made.value.skills.map((s) => ({ name: s.name, tier: s.tier })));
    const critic = await generateStructured({ task: "role_resolve", system: review.system, user: review.user, schema: RoleCriticSchema, temperature: 0, maxTokens: 3000, promptVersion: ROLE_CRITIC_PROMPT_VERSION }, deps);
    const gate = applyCritique(made.value, critic.value);
    const here = { framework: made.value, critique: critic.value, gate, provider: made.provider, model: made.model };
    if (gate.ok) {
      const incomplete = gate.missingCoreSkills.length >= MISSING_RETRY_AT && attempt < FRAMEWORK_ATTEMPTS && Date.now() - startedAt < COMPLETENESS_RETRY_BUDGET_MS;
      if (!incomplete) return finish(title, preferred && preferred.gate.missingCoreSkills.length <= gate.missingCoreSkills.length ? preferred : here, true, attempt);
      // sound but incomplete: ask again with the reviewer's missing skills, and keep whichever draft misses fewer
      preferred = here;
      feedback = [`The reviewer found these important entry-level skills of this role missing; cover them if they really belong to the role: ${gate.missingCoreSkills.join(", ")}`];
      continue;
    }
    if (preferred) return finish(title, preferred, true, attempt); // the retry was worse: the first sound draft stands
    if (!best || gate.skills.length > best.gate.skills.length) best = here;
    feedback = gate.reasons;
  }
  if (preferred) return finish(title, preferred, true, FRAMEWORK_ATTEMPTS);
  // Not verified after the retry. Keep the better draft only if the reviewer agreed it is this role and enough relevant skills survived; otherwise refuse.
  if (best && best.critique.roleIdentityMatches && best.gate.skills.length >= 8 && best.gate.skills.filter((s) => s.tier === "CORE").length >= 4) return finish(title, best, false, FRAMEWORK_ATTEMPTS);
  throw new FrameworkUnavailable("We couldn't build a reliable skill profile for that role yet.", feedback ?? []);
}

function finish(title: string, r: { framework: RoleFramework; critique: RoleCritique; gate: GateResult; provider: string; model: string }, verified: boolean, attempts: number): BuiltFramework {
  return {
    title, framework: r.framework, critique: r.critique, gate: r.gate, verified, attempts,
    provenance: { provider: r.provider, model: r.model, promptVersions: [ROLE_IDENTIFY_PROMPT_VERSION, ROLE_FRAMEWORK_PROMPT_VERSION, ROLE_CRITIC_PROMPT_VERSION] },
  };
}

export type ValidationStatus = "DRAFT" | "AI_GENERATED" | "UNDER_REVIEW" | "APPROVED" | "PUBLISHED" | "NEEDS_REVISION" | "ARCHIVED";

/** What is stored with a generated role so its trust level is never guessed later. No external sources are consulted, and the record says so. */
export function frameworkMeta(b: BuiltFramework, identity: RoleIdentity | null, specializationOf: string | null, now: Date = new Date()) {
  return {
    frameworkVersion: 2,
    roleConfidence: identity?.roleConfidence ?? null,
    competencyConfidence: b.gate.competencyConfidence,
    sourceCoverage: "NONE" as const,
    sources: [] as { name: string; reference: string }[],
    researchedAt: now.toISOString(),
    researchNote: "Drafted from the model's general knowledge and reviewed by a second, independent model pass. No external occupational sources were consulted. Not yet reviewed by a person.",
    verifiedByReviewerPass: b.verified,
    needsHumanReview: true,
    critic: { roleIdentityMatches: b.critique.roleIdentityMatches, confidence: b.critique.confidence, concerns: b.critique.concerns },
    droppedSkills: b.gate.dropped,
    missingCoreSkills: b.gate.missingCoreSkills,
    attempts: b.attempts,
    identity: identity ? { industry: identity.industry, domain: identity.domain, seniority: identity.seniority } : null,
    specializationOf,
    roleSummary: b.framework.roleSummary,
    entryLevelExpectation: b.framework.entryLevelExpectation,
    responsibilities: b.framework.responsibilities,
    tools: b.framework.tools,
    provenance: b.provenance,
  };
}
