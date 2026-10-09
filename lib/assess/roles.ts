// Role resolution: free text -> a confirmed canonical role with a complete skill set.
//
// Order of preference: (1) an existing role or alias (the registry, cheapest and consistent), (2) otherwise the model proposes a normalised
// role plus a complete, schema-validated skill profile, which is persisted ONCE and reused by the next student who types the same thing.
// Nothing here chooses for the student: it returns candidates and the student confirms one.

import { generateStructured, type GenerateDeps } from "@/lib/ai/llm";
import { ROLE_PROFILE_PROMPT_VERSION, RoleProfileSchema, roleProfilePrompt, type RoleProfile } from "@/lib/ai/llm/prompts/role-profile.v1";
import { buildSkillIndex, resolveSkill } from "@/lib/skills/resolve";
import type { Db } from "./db";
import { checkRoleInput, normalizeRole, skillKeyOf, slugOf } from "./role-input";

/** A match at or above this is offered as "the" role; below it the model is asked (weaker matches become alternatives). */
export const GOOD_MATCH = 0.8;

export interface RoleSkillView {
  name: string;
  category: string | null;
  importance: "CRITICAL" | "HIGH" | "MEDIUM" | "LOW";
}
export interface RoleCandidate {
  careerId: string;
  key: string;
  name: string;
  status: "CURATED" | "AI_GENERATED" | "REVIEWED";
  score: number;
  skills: RoleSkillView[];
}
export type ResolveOutcome =
  | { status: "MATCHED" | "GENERATED"; primary: RoleCandidate; alternatives: RoleCandidate[] }
  | { status: "REJECTED"; message: string };

async function withSkills(db: Db, rows: { career_id: string; key: string; name: string; status: RoleCandidate["status"]; score: number }[]): Promise<RoleCandidate[]> {
  if (rows.length === 0) return [];
  const { data } = await db
    .from("career_skill_requirements")
    .select("career_id, importance, assessment_weight, skills!inner(name, category)")
    .in("career_id", rows.map((r) => r.career_id));
  type Row = { career_id: string; importance: RoleSkillView["importance"]; assessment_weight: number; skills: { name: string; category: string | null } };
  const by = new Map<string, (RoleSkillView & { w: number })[]>();
  for (const r of (data ?? []) as unknown as Row[]) by.set(r.career_id, [...(by.get(r.career_id) ?? []), { name: r.skills.name, category: r.skills.category, importance: r.importance, w: Number(r.assessment_weight) }]);
  return rows.map((r) => ({
    careerId: r.career_id, key: r.key, name: r.name, status: r.status, score: r.score,
    skills: (by.get(r.career_id) ?? []).sort((a, b) => b.w - a.w).map(({ w: _w, ...s }) => { void _w; return s; }),
  }));
}

export interface RoleOption extends RoleCandidate {
  aliases: string[];
}

/** Every selectable role with its skills and aliases, for the picker that ships with the page (small: a few hundred rows). */
export async function loadRoleOptions(db: Db): Promise<RoleOption[]> {
  const [{ data: careers }, { data: aliases }] = await Promise.all([
    db.from("careers").select("id, key, name, status").eq("is_active", true).order("name"),
    db.from("career_aliases").select("career_id, alias").order("alias").limit(3000),
  ]);
  const rows = ((careers ?? []) as { id: string; key: string; name: string; status: RoleCandidate["status"] }[]).map((c) => ({ career_id: c.id, key: c.key, name: c.name, status: c.status, score: 1 }));
  const withS = await withSkills(db, rows);
  const by = new Map<string, string[]>();
  for (const a of (aliases ?? []) as { career_id: string; alias: string }[]) by.set(a.career_id, [...(by.get(a.career_id) ?? []), a.alias]);
  return withS.filter((r) => r.skills.length > 0).map((r) => ({ ...r, aliases: by.get(r.careerId) ?? [] }));
}

async function matchExisting(db: Db, text: string): Promise<RoleCandidate[]> {
  const { data, error } = await db.rpc("match_careers", { p_query: text, p_limit: 5 });
  if (error) throw error;
  return withSkills(db, ((data ?? []) as { career_id: string; key: string; name: string; status: RoleCandidate["status"]; score: number }[]).map((r) => ({ ...r })));
}

async function bumpAlias(db: Db, alias: string, careerId: string, source: "STUDENT" | "AI"): Promise<void> {
  if (!alias || alias.length > 80) return;
  // an alias that already exists keeps pointing where it did; only new words are added
  await db.from("career_aliases").upsert({ alias, career_id: careerId, source }, { onConflict: "alias", ignoreDuplicates: true });
}

/**
 * Persists a validated profile. Skills are mapped onto the existing canonical catalogue first (alias/name match), and only
 * genuinely new skills are created, so "SQL" from a generated role is THE SQL skill, not a duplicate.
 */
export async function persistGeneratedRole(db: Db, profile: RoleProfile, by: { provider: string; model: string; promptVersion: string }, studentText: string): Promise<RoleCandidate> {
  const key = `ai-${slugOf(profile.roleName)}`;
  const existing = await db.from("careers").select("id").eq("key", key).maybeSingle();
  let careerId: string = existing.data?.id ?? "";

  if (!careerId) {
    const { data: created, error } = await db
      .from("careers")
      .insert({ key, name: profile.roleName, description: `AI-proposed profile for ${profile.roleName}`, category: "AI generated", is_active: true, status: "AI_GENERATED", provider: by.provider, model: by.model, prompt_version: by.promptVersion })
      .select("id")
      .single();
    if (error) {
      if (error.code !== "23505") throw error; // two students generated the same new role at once: use the winner's
      careerId = (await db.from("careers").select("id").eq("key", key).single()).data!.id;
    } else {
      careerId = created.id as string;
      await attachSkills(db, careerId, profile);
    }
  }
  const aliases = new Set([normalizeRole(profile.roleName), ...profile.aliases.map(normalizeRole)]);
  for (const a of aliases) await bumpAlias(db, a, careerId, "AI");
  const typed = normalizeRole(studentText);
  if (typed.split(" ").length <= 8) await bumpAlias(db, typed, careerId, "STUDENT");

  const [view] = await withSkills(db, [{ career_id: careerId, key, name: profile.roleName, status: "AI_GENERATED", score: 1 }]);
  return view;
}

async function attachSkills(db: Db, careerId: string, profile: RoleProfile): Promise<void> {
  const [{ data: skills }, { data: aliases }] = await Promise.all([
    db.from("skills").select("id, name, status"),
    db.from("skill_aliases").select("skill_id, alias"),
  ]);
  const index = buildSkillIndex(skills ?? [], ((aliases ?? []) as { skill_id: string; alias: string }[]).map((a) => ({ skillId: a.skill_id, alias: a.alias })));

  const rows: Record<string, unknown>[] = [];
  const used = new Set<string>();
  for (const s of profile.skills) {
    let skillId = resolveSkill(s.name, index)?.skillId ?? null;
    if (!skillId) {
      const ins = await db.from("skills").insert({ key: skillKeyOf(s.name), name: s.name, category: s.category, description: s.description ?? null, status: "active" }).select("id").single();
      if (ins.error) {
        // name/key already taken by a skill the resolver could not see: reuse it rather than fail the whole role
        const again = await db.from("skills").select("id").or(`key.eq.${skillKeyOf(s.name)},name.eq.${s.name}`).order("created_at").limit(1).maybeSingle();
        if (!again.data) throw ins.error;
        skillId = again.data.id;
      } else skillId = ins.data.id;
      await db.from("skill_categories").upsert({ key: s.category, name: s.category }, { onConflict: "key", ignoreDuplicates: true });
    }
    if (used.has(skillId!)) continue; // two profile skills resolved to the same canonical skill
    used.add(skillId!);
    rows.push({
      career_id: careerId, skill_id: skillId, importance: s.importance, target_level: s.targetLevel, assessment_weight: s.assessmentWeight,
      min_questions: s.minQuestions, max_questions: Math.max(s.maxQuestions, s.minQuestions),
      required_by_stage: s.importance === "CRITICAL" ? "FOUNDATION" : s.importance === "HIGH" ? "INTERMEDIATE" : "JOB_READY",
    });
  }
  const { error } = await db.from("career_skill_requirements").insert(rows);
  if (error) throw error;
}

export async function resolveRole(db: Db, rawInput: string, deps: GenerateDeps = {}): Promise<ResolveOutcome> {
  const checked = checkRoleInput(rawInput);
  if (!checked.ok) return { status: "REJECTED", message: checked.message };

  const found = await matchExisting(db, checked.text);
  const [best, ...rest] = found;
  if (best && best.score >= GOOD_MATCH) {
    return { status: "MATCHED", primary: best, alternatives: rest.filter((r) => r.score >= 0.3).slice(0, 3) };
  }

  const { system, user } = roleProfilePrompt(checked.text, found.map((f) => f.name));
  let out;
  try {
    out = await generateStructured({ task: "role_profile", system, user, schema: RoleProfileSchema, temperature: 0.2, maxTokens: 3800, promptVersion: ROLE_PROFILE_PROMPT_VERSION }, deps);
  } catch (e) {
    // An answer we could not use means the text did not describe a role the model could profile. An outage is different: then a
    // reasonably close registry match is better than failing, and the student still confirms it.
    if ((e as { kind?: string }).kind === "invalid_output") return { status: "REJECTED", message: "We couldn't turn that into a role. Try naming the job title." };
    if (best && best.score >= 0.35) return { status: "MATCHED", primary: best, alternatives: rest.slice(0, 3) };
    throw e;
  }
  const same = out.value.sameAsExistingRole?.trim().toLowerCase();
  const existing = same ? found.find((f) => f.name.toLowerCase() === same) : undefined;
  if (existing) {
    await bumpAlias(db, normalizeRole(checked.text), existing.careerId, "STUDENT"); // next student typing this skips the model
    return { status: "MATCHED", primary: existing, alternatives: found.filter((f) => f !== existing).slice(0, 3) };
  }
  if (out.value.sameAsExistingRole) return { status: "REJECTED", message: "We couldn't match that to a role. Try naming the job title." }; // pointed at a role that is not in the list
  if (!out.value.isValidRole) return { status: "REJECTED", message: out.value.rejectReason || "That doesn't look like a career role. Try naming the job title." };

  const primary = await persistGeneratedRole(db, out.value, { provider: out.provider, model: out.model, promptVersion: out.promptVersion }, checked.text);
  return { status: "GENERATED", primary, alternatives: found.slice(0, 3) };
}
