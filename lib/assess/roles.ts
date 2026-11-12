// Role resolution: free text -> a confirmed role with an accurate, reviewed-or-labelled competency framework.
//
// Order of preference: (1) an exact, spelling-variant or trusted-alias match in the registry (deterministic, cheapest, consistent); (2) otherwise the model
// IDENTIFIES the job and may ask the student to clarify (a broad title, or a close-but-different existing role); (3) only then a framework is built for the
// exact title the student confirmed, reviewed by an independent pass, and stored once with its confidence and provenance for the next student.
// Nothing here ever decides for the student that two different titles are the same job: "close" is offered, never applied.

import type { GenerateDeps } from "@/lib/ai/llm";
import { buildSkillIndex, resolveSkill } from "@/lib/skills/resolve";
import type { Db } from "./db";
import { checkRoleInput, isSpellingVariant, normalizeRole, sharesField, skillKeyOf, slugOf } from "./role-input";
import { FrameworkUnavailable, buildFramework, frameworkMeta, identifyRole, type BuiltFramework, type RoleIdentity } from "./role-framework";

/** A match at or above this is offered as "the" role when the words really do match; below it the model is asked. */
export const GOOD_MATCH = 0.8;

export interface RoleSkillView {
  name: string;
  category: string | null;
  importance: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
  /** CORE, INDUSTRY, TOOL, PRACTICAL, SUPPORTING, ANALYTICAL, ADVANCED: how the role uses it (absent on older roles) */
  competencyClass?: string | null;
  /** how it is assessed: coding, sql, calculation, case_study, practical ... (absent on older roles) */
  assessmentType?: string | null;
}
export interface RoleValidation {
  /** DRAFT, AI_GENERATED, UNDER_REVIEW, APPROVED, PUBLISHED, NEEDS_REVISION, ARCHIVED */
  status: string;
  roleConfidence: number | null;
  competencyConfidence: number | null;
  /** NONE when no external occupational source was consulted */
  sourceCoverage: string | null;
  needsHumanReview: boolean;
}
export interface RoleCandidate {
  careerId: string;
  key: string;
  name: string;
  status: "CURATED" | "AI_GENERATED" | "REVIEWED";
  score: number;
  skills: RoleSkillView[];
  validation?: RoleValidation;
}

export type ClarifyOption =
  | { kind: "existing"; candidate: RoleCandidate }
  | { kind: "specialization"; title: string; description: string; parent: string; industry: string; domain: string }
  | { kind: "as_typed"; title: string; industry: string; domain: string };
export type ResolveChoice =
  | { kind: "existing"; careerId: string }
  | { kind: "specialization"; title: string; parent: string; industry: string; domain: string }
  | { kind: "as_typed"; title: string; industry: string; domain: string };
export type ResolveOutcome =
  | { status: "MATCHED" | "GENERATED"; primary: RoleCandidate; alternatives: RoleCandidate[] }
  | { status: "CLARIFY"; typed: string; canonicalTitle: string; message: string; options: ClarifyOption[] }
  | { status: "UNAVAILABLE"; message: string }
  | { status: "REJECTED"; message: string };

type CareerRow = { career_id: string; key: string; name: string; status: RoleCandidate["status"]; score: number };

/** Postgres "undefined column": the framework-provenance migration (194) has not been applied yet. The code keeps working without it, just without provenance. */
const isMissingColumn = (e: { code?: string } | null) => e?.code === "42703" || e?.code === "PGRST204";

async function withSkills(db: Db, rows: CareerRow[]): Promise<RoleCandidate[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.career_id);
  const [first, { data: meta }] = await Promise.all([
    db.from("career_skill_requirements").select("career_id, importance, assessment_weight, competency_class, assessment_type, skills!inner(name, category)").in("career_id", ids),
    db.from("careers").select("id, validation_status, framework_meta").in("id", ids),
  ]);
  const { data } = isMissingColumn(first.error)
    ? await db.from("career_skill_requirements").select("career_id, importance, assessment_weight, skills!inner(name, category)").in("career_id", ids)
    : first;
  type Row = { career_id: string; importance: RoleSkillView["importance"]; assessment_weight: number; competency_class: string | null; assessment_type: string | null; skills: { name: string; category: string | null } };
  const by = new Map<string, (RoleSkillView & { w: number })[]>();
  for (const r of (data ?? []) as unknown as Row[]) by.set(r.career_id, [...(by.get(r.career_id) ?? []), { name: r.skills.name, category: r.skills.category, importance: r.importance, competencyClass: r.competency_class, assessmentType: r.assessment_type, w: Number(r.assessment_weight) }]);
  type Meta = { id: string; validation_status: string | null; framework_meta: { roleConfidence?: number | null; competencyConfidence?: number | null; sourceCoverage?: string; needsHumanReview?: boolean } | null };
  const metaOf = new Map(((meta ?? []) as Meta[]).map((m) => [m.id, m]));
  return rows.map((r) => {
    const m = metaOf.get(r.career_id);
    const fm = m?.framework_meta ?? null;
    return {
      careerId: r.career_id, key: r.key, name: r.name, status: r.status, score: r.score,
      skills: (by.get(r.career_id) ?? []).sort((a, b) => b.w - a.w).map(({ w: _w, ...s }) => { void _w; return s; }),
      validation: m?.validation_status ? { status: m.validation_status, roleConfidence: fm?.roleConfidence ?? null, competencyConfidence: fm?.competencyConfidence ?? null, sourceCoverage: fm?.sourceCoverage ?? null, needsHumanReview: fm?.needsHumanReview ?? false } : undefined,
    };
  });
}

export interface RoleOption extends RoleCandidate {
  aliases: string[];
  description: string | null;
}

/**
 * Every selectable role with its skills and aliases, for the picker that ships with the page. Aliases the AI proposed are left out: they would let the picker
 * claim "matches automobile engineer" for a role nobody confirmed means the same thing.
 */
export async function loadRoleOptions(db: Db): Promise<RoleOption[]> {
  const [{ data: careers }, { data: aliases }] = await Promise.all([
    db.from("careers").select("id, key, name, status, description").eq("is_active", true).order("name"),
    db.from("career_aliases").select("career_id, alias, source").order("alias").limit(3000),
  ]);
  const descriptionOf = new Map(((careers ?? []) as { id: string; description: string | null }[]).map((c) => [c.id, c.description]));
  const rows = ((careers ?? []) as { id: string; key: string; name: string; status: RoleCandidate["status"] }[]).map((c) => ({ career_id: c.id, key: c.key, name: c.name, status: c.status, score: 1 }));
  const withS = await withSkills(db, rows);
  const by = new Map<string, string[]>();
  for (const a of (aliases ?? []) as { career_id: string; alias: string; source: string }[]) if (a.source !== "AI") by.set(a.career_id, [...(by.get(a.career_id) ?? []), a.alias]);
  return withS.filter((r) => r.skills.length > 0).map((r) => ({ ...r, aliases: by.get(r.careerId) ?? [], description: descriptionOf.get(r.careerId) ?? null }));
}

async function matchExisting(db: Db, text: string): Promise<RoleCandidate[]> {
  const { data, error } = await db.rpc("match_careers", { p_query: text, p_limit: 6 });
  if (error) throw error;
  return withSkills(db, (data ?? []) as CareerRow[]);
}

async function loadCandidate(db: Db, careerId: string): Promise<RoleCandidate | null> {
  const { data } = await db.from("careers").select("id, key, name, status").eq("id", careerId).eq("is_active", true).maybeSingle();
  if (!data) return null;
  const [c] = await withSkills(db, [{ career_id: data.id as string, key: data.key as string, name: data.name as string, status: data.status as RoleCandidate["status"], score: 1 }]);
  return c.skills.length > 0 ? c : null;
}

/** The names a role is known by that a person (or the curated seed) vouched for. The AI's own aliases never count as vouching. */
async function trustedNames(db: Db, careerIds: string[]): Promise<Map<string, string[]>> {
  const out = new Map<string, string[]>();
  if (careerIds.length === 0) return out;
  const { data } = await db.from("career_aliases").select("career_id, alias, source").in("career_id", careerIds).neq("source", "AI");
  for (const a of (data ?? []) as { career_id: string; alias: string }[]) out.set(a.career_id, [...(out.get(a.career_id) ?? []), a.alias]);
  return out;
}

/** Deterministic: the same words, a one-character typo, or a sentence that contains a name people vouched for. Never "similar sounding". */
export function isStrongMatch(typed: string, candidate: { name: string; score: number }, trusted: readonly string[]): boolean {
  const names = [normalizeRole(candidate.name), ...trusted.map(normalizeRole)];
  if (names.some((n) => n === typed || isSpellingVariant(n, typed))) return true;
  return candidate.score >= GOOD_MATCH && names.some((n) => n.length >= 6 && typed.includes(n));
}

/** A student's own words become an alias only when THEY confirm the role, so the registry never learns an equivalence nobody agreed to. */
export async function rememberStudentAlias(db: Db, careerId: string, typed: string): Promise<void> {
  const alias = normalizeRole(typed);
  if (alias.length < 2 || alias.length > 80 || alias.split(" ").length > 8) return;
  await db.from("career_aliases").upsert({ alias, career_id: careerId, source: "STUDENT" }, { onConflict: "alias", ignoreDuplicates: true });
}

/**
 * Persists a built framework as a new role. Skills are mapped onto the existing canonical catalogue first (alias/name match), and only genuinely new skills
 * are created, so "SQL" from a generated role is THE SQL skill. The role starts as AI_GENERATED with its confidence and provenance recorded; it is never
 * published as verified until a person reviews it.
 */
export async function persistFramework(db: Db, built: BuiltFramework, identity: RoleIdentity | null, specializationOf: string | null): Promise<RoleCandidate> {
  const key = `ai-${slugOf(built.title)}`;
  const existing = await db.from("careers").select("id").eq("key", key).maybeSingle();
  let careerId: string = existing.data?.id ?? "";

  if (!careerId) {
    const meta = frameworkMeta(built, identity, specializationOf);
    const base = {
      key, name: built.title, description: built.framework.roleSummary.slice(0, 400), category: identity?.domain || "AI generated", is_active: true, status: "AI_GENERATED",
      provider: built.provenance.provider, model: built.provenance.model, prompt_version: built.provenance.promptVersions[1],
    };
    let { data: created, error } = await db.from("careers").insert({ ...base, validation_status: "AI_GENERATED", framework_version: 2, framework_meta: meta }).select("id").single();
    if (isMissingColumn(error)) ({ data: created, error } = await db.from("careers").insert(base).select("id").single());
    if (error) {
      if (error.code !== "23505") throw error; // two students built the same new role at once: use the winner's
      careerId = (await db.from("careers").select("id").eq("key", key).single()).data!.id;
    } else {
      careerId = created!.id as string;
      await attachSkills(db, careerId, built);
    }
  }
  // the student chose this exact title, so its own name is a vouched-for alias
  await db.from("career_aliases").upsert({ alias: normalizeRole(built.title), career_id: careerId, source: "STUDENT" }, { onConflict: "alias", ignoreDuplicates: true });
  const [view] = await withSkills(db, [{ career_id: careerId, key, name: built.title, status: "AI_GENERATED", score: 1 }]);
  return view;
}

async function attachSkills(db: Db, careerId: string, built: BuiltFramework): Promise<void> {
  const [{ data: skills }, { data: aliases }] = await Promise.all([
    db.from("skills").select("id, name, status"),
    db.from("skill_aliases").select("skill_id, alias"),
  ]);
  const index = buildSkillIndex(skills ?? [], ((aliases ?? []) as { skill_id: string; alias: string }[]).map((a) => ({ skillId: a.skill_id, alias: a.alias })));

  const rows: Record<string, unknown>[] = [];
  const used = new Set<string>();
  for (const s of built.gate.skills) {
    let skillId = resolveSkill(s.name, index)?.skillId ?? null;
    if (!skillId) {
      const ins = await db.from("skills").insert({ key: skillKeyOf(s.name), name: s.name, category: s.category, description: s.description, status: "active" }).select("id").single();
      if (ins.error) {
        // name/key already taken by a skill the resolver could not see: reuse it rather than fail the whole role
        const again = await db.from("skills").select("id").or(`key.eq.${skillKeyOf(s.name)},name.eq.${s.name}`).order("created_at").limit(1).maybeSingle();
        if (!again.data) throw ins.error;
        skillId = again.data.id;
      } else skillId = ins.data.id;
      await db.from("skill_categories").upsert({ key: s.category, name: s.category }, { onConflict: "key", ignoreDuplicates: true });
    }
    if (used.has(skillId!)) continue; // two framework skills resolved to the same canonical skill
    used.add(skillId!);
    rows.push({
      career_id: careerId, skill_id: skillId, importance: s.importance, target_level: s.targetLevel, assessment_weight: s.assessmentWeight,
      min_questions: s.minQuestions, max_questions: s.maxQuestions, competency_class: s.tier, assessment_type: s.assessmentType, rationale: s.rationale,
      required_by_stage: s.importance === "CRITICAL" ? "FOUNDATION" : s.importance === "HIGH" ? "INTERMEDIATE" : "JOB_READY",
    });
  }
  let { error } = await db.from("career_skill_requirements").insert(rows);
  if (isMissingColumn(error)) ({ error } = await db.from("career_skill_requirements").insert(rows.map(({ competency_class: _c, assessment_type: _a, rationale: _r, ...legacy }) => { void _c; void _a; void _r; return legacy; })));
  if (error) throw error;
}

const UNAVAILABLE = "We couldn't build a reliable skill profile for that role just now. Please try again in a moment, or choose a role from the list.";

async function generate(db: Db, title: string, ctx: { industry: string; domain: string; specializationOf?: string }, identity: RoleIdentity | null, deps: GenerateDeps): Promise<ResolveOutcome> {
  try {
    const built = await buildFramework(title, ctx, deps);
    const primary = await persistFramework(db, built, identity, ctx.specializationOf ?? null);
    return { status: "GENERATED", primary, alternatives: [] };
  } catch (e) {
    if (e instanceof FrameworkUnavailable) return { status: "UNAVAILABLE", message: UNAVAILABLE };
    if ((e as { kind?: string }).kind) return { status: "UNAVAILABLE", message: UNAVAILABLE }; // a model outage: say so, never substitute generic skills
    throw e;
  }
}

export async function resolveRole(db: Db, rawInput: string, deps: GenerateDeps = {}, choice?: ResolveChoice): Promise<ResolveOutcome> {
  const checked = checkRoleInput(rawInput);
  if (!checked.ok) return { status: "REJECTED", message: checked.message };
  const typed = checked.text;

  if (choice?.kind === "existing") {
    const c = await loadCandidate(db, choice.careerId);
    return c ? { status: "MATCHED", primary: c, alternatives: [] } : { status: "REJECTED", message: "That role is no longer available. Try naming the job title." };
  }
  if (choice?.kind === "specialization") return generate(db, choice.title, { industry: choice.industry, domain: choice.domain, specializationOf: choice.parent }, null, deps);
  if (choice?.kind === "as_typed") return generate(db, choice.title, { industry: choice.industry, domain: choice.domain }, null, deps);

  const found = await matchExisting(db, typed);
  const trusted = await trustedNames(db, found.map((f) => f.careerId));
  const strong = found.find((f) => isStrongMatch(typed, f, trusted.get(f.careerId) ?? []));
  if (strong) return { status: "MATCHED", primary: strong, alternatives: found.filter((f) => f !== strong && sharesField(typed, f.name)).slice(0, 3) };

  let identified: Awaited<ReturnType<typeof identifyRole>>;
  try {
    identified = await identifyRole(typed, found.filter((f) => sharesField(typed, f.name)).map((f) => f.name), deps);
  } catch (e) {
    if ((e as { kind?: string }).kind === "invalid_output") return { status: "REJECTED", message: "We couldn't turn that into a role. Try naming the job title." };
    return { status: "UNAVAILABLE", message: UNAVAILABLE }; // an outage is not a reason to guess a role
  }
  const id = identified.identity;
  if (!id.isValidRole) return { status: "REJECTED", message: id.rejectReason || "That doesn't look like a career role. Try naming the job title." };
  const title = id.canonicalTitle || typed;
  const canonical = normalizeRole(title);

  // the corrected title IS an existing role (a spelling fix): use it
  const same = found.find((f) => normalizeRole(f.name) === canonical || (trusted.get(f.careerId) ?? []).map(normalizeRole).includes(canonical));
  if (same) return { status: "MATCHED", primary: same, alternatives: [] };

  const options: ClarifyOption[] = [];
  const suggested = id.closestExistingRole ? found.find((f) => f.name.toLowerCase() === id.closestExistingRole!.toLowerCase()) : undefined;
  if (suggested) options.push({ kind: "existing", candidate: suggested });
  if (id.specializationsNeeded && id.specializations.length >= 2) {
    for (const s of id.specializations) options.push({ kind: "specialization", title: s.title, description: s.description, parent: title, industry: id.industry, domain: id.domain });
    options.push({ kind: "as_typed", title, industry: id.industry, domain: id.domain });
    return { status: "CLARIFY", typed: title, canonicalTitle: title, message: `“${title}” covers different jobs with different skills. Which one are you aiming for?`, options };
  }
  if (suggested) {
    options.push({ kind: "as_typed", title, industry: id.industry, domain: id.domain });
    return { status: "CLARIFY", typed: title, canonicalTitle: title, message: `We already have “${suggested.name}”. Is that what you mean, or is “${title}” a different role?`, options };
  }
  return generate(db, title, { industry: id.industry, domain: id.domain }, id, deps);
}
