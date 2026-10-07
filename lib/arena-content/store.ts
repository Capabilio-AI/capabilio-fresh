import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { specHash } from "./hash";
import { ChallengeSpec, TemplateSpec } from "./spec";
import type { ValidationDeps } from "./validate";

type Service = SupabaseClient<Database>;

export class ContentError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

/** Templates, skill names and career keys as they exist in the database (and so what a spec may reference). */
export async function loadReferenceData(service: Service): Promise<Pick<ValidationDeps, "templates" | "skillNames" | "careerKeys">> {
  const db = untyped(service);
  const [{ data: templates }, { data: skills }, { data: careers }] = await Promise.all([
    db.from("workstation_templates").select("key, name, runtime_type, description, config, tools, resource_limits, startup_time_estimate_s").eq("is_active", true),
    service.from("skills").select("name").eq("status", "active"),
    service.from("careers").select("key").eq("is_active", true),
  ]);
  type T = { key: string; name: string; runtime_type: TemplateSpec["runtimeType"]; description: string | null; config: Record<string, unknown>; tools: string[]; resource_limits: Record<string, unknown>; startup_time_estimate_s: number | null };
  return {
    templates: new Map(((templates ?? []) as T[]).map((t) => [t.key, { key: t.key, name: t.name, runtimeType: t.runtime_type, description: t.description ?? undefined, config: t.config, tools: t.tools, resourceLimits: t.resource_limits, startupTimeEstimateS: t.startup_time_estimate_s ?? undefined }])),
    skillNames: new Set((skills ?? []).map((s) => s.name)),
    careerKeys: new Set((careers ?? []).map((c) => c.key)),
  };
}

export async function upsertTemplates(service: Service, templates: TemplateSpec[]): Promise<void> {
  const rows = templates.map((t) => ({ key: t.key, name: t.name, runtime_type: t.runtimeType, description: t.description ?? null, config: t.config, tools: t.tools, resource_limits: t.resourceLimits, startup_time_estimate_s: t.startupTimeEstimateS ?? null, is_active: true }));
  const { error } = await untyped(service).from("workstation_templates").upsert(rows, { onConflict: "key" });
  if (error) throw error;
}

const lower = (names: string[]) => names.map((n) => n.trim().toLowerCase());

/**
 * Writes a spec as a DRAFT challenge (creating or replacing by spec key). Re-importing an unchanged spec is a no-op; any change sends the
 * challenge back to DRAFT and clears its validation, so what is live was always validated as it stands.
 */
export async function importSpec(service: Service, input: unknown): Promise<{ id: string; key: string; changed: boolean }> {
  const spec = ChallengeSpec.parse(input);
  const db = untyped(service);
  const hash = specHash(spec);

  const { data: existing } = await db.from("arena_challenges").select("id, status, validated_hash, spec").eq("spec_key", spec.key).maybeSingle();
  if (existing?.spec && specHash(existing.spec) === hash) return { id: existing.id, key: spec.key, changed: false };

  const [{ data: template }, { data: skills }, { data: careers }] = await Promise.all([
    db.from("workstation_templates").select("id").eq("key", spec.template).eq("is_active", true).maybeSingle(),
    service.from("skills").select("id, name").eq("status", "active").in("name", spec.skills),
    spec.careers.length ? service.from("careers").select("id, key").eq("is_active", true).in("key", spec.careers) : Promise.resolve({ data: [] as { id: string; key: string }[] }),
  ]);
  if (!template) throw new ContentError(`Unknown workstation template "${spec.template}".`);
  const missingSkills = spec.skills.filter((s) => !(skills ?? []).some((k) => k.name === s));
  if (missingSkills.length) throw new ContentError(`Unknown skills: ${missingSkills.join(", ")}.`);
  const missingCareers = spec.careers.filter((c) => !(careers ?? []).some((k) => k.key === c));
  if (missingCareers.length) throw new ContentError(`Unknown careers: ${missingCareers.join(", ")}.`);

  const row = {
    track: spec.track,
    scope_key: spec.track === "domain" ? spec.careers[0] : `spec-${spec.key}`,
    title: spec.title,
    category: spec.category,
    difficulty: spec.difficulty,
    time_limit_minutes: spec.timeLimitMinutes ?? Math.max(spec.estMinutes, 10),
    est_minutes: spec.estMinutes,
    scenario: spec.ticketBrief,
    objective: spec.title,
    language: "none",
    expected_output: "",
    kind: "workstation",
    skill_tags: spec.skills,
    ticket_brief: spec.ticketBrief,
    workstation_template_id: template.id,
    starter_assets_ref: spec.assets,
    branch_keys: lower(spec.branches),
    course_tags: spec.courseTags,
    source: spec.source,
    institution_id: spec.institutionId ?? null,
    is_seed: spec.isSeed,
    source_notes: spec.provenance ?? null,
    spec_version: spec.specVersion,
    spec_key: spec.key,
    spec,
    status: "DRAFT",
    validated_hash: null,
    validated_at: null,
    reviewed_by: null,
    reviewed_at: null,
  };
  const saved = existing ? await db.from("arena_challenges").update(row).eq("id", existing.id).select("id").single() : await db.from("arena_challenges").insert(row).select("id").single();
  if (saved.error) throw saved.error;
  const id = saved.data.id as string;

  if (existing) {
    for (const table of ["challenge_steps", "challenge_checks", "challenge_hints", "challenge_careers"]) await db.from(table).delete().eq("challenge_id", id);
    await db.from("arena_challenge_skills").delete().eq("challenge_id", id).eq("source", "SPEC");
  }
  const stepRows = await db.from("challenge_steps").insert(spec.steps.map((s, i) => ({ challenge_id: id, step_order: i + 1, title: s.title, instruction: s.instruction }))).select("id, step_order");
  if (stepRows.error) throw stepRows.error;
  const stepId = new Map((stepRows.data as { id: string; step_order: number }[]).map((s) => [s.step_order, s.id]));
  const checks = await db.from("challenge_checks").insert(spec.checks.map((c) => ({ challenge_id: id, step_id: c.step ? stepId.get(c.step) : null, check_type: c.type, label: c.label, config: c.config, visible: c.visible, weight: c.weight, verification: c.verification })));
  if (checks.error) throw checks.error;
  if (spec.hints.length) {
    const hints = await db.from("challenge_hints").insert(spec.hints.map((h, i) => ({ challenge_id: id, hint_order: i + 1, body: h.body, penalty_points: h.penalty })));
    if (hints.error) throw hints.error;
  }
  if ((careers ?? []).length) await db.from("challenge_careers").insert((careers ?? []).map((c) => ({ challenge_id: id, career_id: c.id })));
  await db.from("arena_challenge_skills").upsert((skills ?? []).map((s) => ({ challenge_id: id, skill_id: s.id, source: "SPEC" })), { onConflict: "challenge_id,skill_id" });
  return { id, key: spec.key, changed: true };
}

async function loadSpecRow(service: Service, ref: { id?: string; key?: string }) {
  const q = untyped(service).from("arena_challenges").select("id, status, source, spec, validated_hash, user_id, spec_key, title");
  const { data } = await (ref.id ? q.eq("id", ref.id) : q.eq("spec_key", ref.key ?? "")).maybeSingle();
  if (!data || data.user_id) throw new ContentError("Challenge not found.", 404);
  return data as { id: string; status: string; source: string; spec: unknown; validated_hash: string | null; spec_key: string | null; title: string };
}

/** Records that the spec, exactly as stored, passed validation. Publishing requires this. */
export async function markValidated(service: Service, ref: { id?: string; key?: string }): Promise<string> {
  const row = await loadSpecRow(service, ref);
  if (!row.spec) throw new ContentError("This challenge has no spec to validate.");
  const hash = specHash(row.spec);
  const { error } = await untyped(service).from("arena_challenges").update({ validated_hash: hash, validated_at: new Date().toISOString() }).eq("id", row.id);
  if (error) throw error;
  return hash;
}

/** DRAFT -> PUBLISHED, only for a spec whose current hash was validated. `adminId` is recorded as the reviewer when there is one. */
export async function publishChallenge(service: Service, ref: { id?: string; key?: string }, adminId: string | null): Promise<void> {
  const row = await loadSpecRow(service, ref);
  if (row.status === "PUBLISHED") return;
  if (!row.spec) throw new ContentError("Only authored specs are published here. Legacy AI drafts are approved with approveLegacyDraft.");
  if (row.validated_hash !== specHash(row.spec)) throw new ContentError("Validate this challenge first — it has changed since it was last validated.", 409);
  const { error } = await untyped(service).from("arena_challenges").update({ status: "PUBLISHED", reviewed_by: adminId, reviewed_at: adminId ? new Date().toISOString() : null }).eq("id", row.id);
  if (error) throw error;
}

export async function retireChallenge(service: Service, ref: { id?: string; key?: string }): Promise<void> {
  const row = await loadSpecRow(service, ref);
  const { error } = await untyped(service).from("arena_challenges").update({ status: "RETIRED" }).eq("id", row.id);
  if (error) throw error;
}

/** A person reviews an AI-generated draft (the classic code / calculation kinds, which have no spec) and publishes it. Needs a real reviewer. */
export async function approveLegacyDraft(service: Service, id: string, adminId: string): Promise<void> {
  const row = await loadSpecRow(service, { id });
  if (row.spec) throw new ContentError("This challenge has a spec; validate and publish it instead.");
  if (row.status !== "DRAFT") throw new ContentError("Only a draft can be approved.", 409);
  const { error } = await untyped(service).from("arena_challenges").update({ status: "PUBLISHED", reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

export interface ChallengeListItem {
  id: string;
  specKey: string | null;
  title: string;
  track: string;
  status: string;
  source: string;
  difficulty: string;
  isSeed: boolean;
  grandfathered: boolean;
  hasSpec: boolean;
  validated: boolean;
  scope: string;
}

export async function listChallenges(service: Service): Promise<ChallengeListItem[]> {
  const { data } = await untyped(service)
    .from("arena_challenges")
    .select("id, spec_key, title, track, status, source, difficulty, is_seed, grandfathered, spec, validated_hash, scope_key")
    .is("user_id", null)
    .order("track")
    .order("created_at", { ascending: false })
    .limit(500);
  return ((data ?? []) as { id: string; spec_key: string | null; title: string; track: string; status: string; source: string; difficulty: string; is_seed: boolean; grandfathered: boolean; spec: unknown; validated_hash: string | null; scope_key: string }[]).map((r) => ({
    id: r.id, specKey: r.spec_key, title: r.title, track: r.track, status: r.status, source: r.source, difficulty: r.difficulty, isSeed: r.is_seed, grandfathered: r.grandfathered,
    hasSpec: Boolean(r.spec), validated: Boolean(r.spec) && r.validated_hash === specHash(r.spec), scope: r.scope_key,
  }));
}

export async function grantPlatformAdmin(service: Service, email: string): Promise<string> {
  const { data } = await service.auth.admin.listUsers({ perPage: 1000 });
  const user = data.users.find((u) => u.email?.toLowerCase() === email.toLowerCase());
  if (!user) throw new ContentError(`No user with email ${email}.`, 404);
  const { error } = await untyped(service).from("platform_admins").upsert({ user_id: user.id }, { onConflict: "user_id" });
  if (error) throw error;
  return user.id;
}

export async function isPlatformAdmin(service: Service, userId: string): Promise<boolean> {
  const { data } = await untyped(service).from("platform_admins").select("user_id").eq("user_id", userId).maybeSingle();
  return Boolean(data);
}
