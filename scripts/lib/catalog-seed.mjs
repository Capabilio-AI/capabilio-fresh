// Operator seed path for the catalogs the roadmap may recommend from (certifications, learning resources, projects).
// Nothing here is invented: the catalogs are filled only from a file an operator prepares, and the whole file is validated BEFORE anything is written —
// an unknown skill or career key stops the run and is listed. Re-running is safe (items are matched by provider + name/title and updated in place).
// Format: docs/catalog-seed-format.md
import { z } from "zod";

const https = z.string().url().refine((u) => u.startsWith("https://"), "must be an https:// URL");
const text = (max) => z.string().trim().min(1).max(max);
const key = z.string().regex(/^(SKILL_[A-Z0-9_]+)$/, "a skill key such as SKILL_SQL");
const careerKey = z.string().regex(/^[a-z0-9-]{2,60}$/, "a career key such as data-analyst");
const difficulty = z.enum(["BEGINNER", "INTERMEDIATE", "ADVANCED"]);

export const SeedSchema = z
  .object({
    certifications: z
      .array(
        z.object({
          name: text(200), provider: text(120), difficulty: difficulty.optional(), url: https.optional(), cost: text(200).optional(), duration: text(200).optional(), eligibility: text(400).optional(),
          isActive: z.boolean().optional(),
          skills: z.array(key).min(1).max(20),
          careers: z.array(z.object({ career: careerKey, relevance: z.enum(["REQUIRED", "RECOMMENDED", "OPTIONAL"]) }).strict()).min(1).max(20),
        }).strict()
      )
      .default([]),
    learning: z
      .array(
        z.object({
          title: text(200), provider: text(120), url: https.optional(), levelFrom: z.number().int().min(0).max(100), levelTo: z.number().int().min(0).max(100), estimatedHours: z.number().positive().max(9999).optional(),
          prerequisites: z.array(text(200)).max(20).optional(), isActive: z.boolean().optional(), skills: z.array(key).min(1).max(20),
        }).strict().refine((l) => l.levelTo > l.levelFrom, { message: "levelTo must be greater than levelFrom" })
      )
      .default([]),
    projects: z
      .array(
        z.object({
          title: text(200), description: text(2000), difficulty, expectedEvidence: z.array(text(300)).max(20).optional(),
          // AI_GENERATED projects are per-student recommendations made by the product, never seeded; COLLEGE projects belong to a college and are not seeded here either
          source: z.enum(["CAPABILIO", "MENTOR"]), status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).optional(), skills: z.array(key).min(1).max(20),
        }).strict()
      )
      .default([]),
  })
  .strict();

/** Pure: the file's own problems (shape, duplicates) as readable lines, or the parsed seed. */
export function validateSeed(json) {
  const parsed = SeedSchema.safeParse(json);
  if (!parsed.success) return { ok: false, problems: parsed.error.issues.map((i) => `${i.path.join(".") || "(file)"}: ${i.message}`) };
  const problems = [];
  const dup = (label, keys) => { const seen = new Set(); for (const k of keys) { if (seen.has(k)) problems.push(`duplicate ${label}: ${k}`); seen.add(k); } };
  dup("certification", parsed.data.certifications.map((c) => `${c.provider} / ${c.name}`));
  dup("learning resource", parsed.data.learning.map((l) => `${l.provider} / ${l.title}`));
  dup("project", parsed.data.projects.map((p) => `${p.source} / ${p.title}`));
  return problems.length ? { ok: false, problems } : { ok: true, seed: parsed.data };
}

/** Applies a validated seed with a service-role client. Unknown skill/career keys stop everything BEFORE any write. */
export async function applySeed(client, seed, { dryRun = false } = {}) {
  const [{ data: skills }, { data: careers }] = await Promise.all([client.from("skills").select("id, key").eq("status", "active"), client.from("careers").select("id, key")]);
  const skillId = new Map((skills ?? []).map((s) => [s.key, s.id]));
  const careerId = new Map((careers ?? []).map((c) => [c.key, c.id]));
  const problems = [];
  const needSkill = (where, k) => { if (!skillId.has(k)) problems.push(`${where}: unknown or inactive skill ${k}`); };
  seed.certifications.forEach((c, i) => { c.skills.forEach((k) => needSkill(`certifications[${i}] ${c.name}`, k)); c.careers.forEach((x) => { if (!careerId.has(x.career)) problems.push(`certifications[${i}] ${c.name}: unknown career ${x.career}`); }); });
  seed.learning.forEach((l, i) => l.skills.forEach((k) => needSkill(`learning[${i}] ${l.title}`, k)));
  seed.projects.forEach((p, i) => p.skills.forEach((k) => needSkill(`projects[${i}] ${p.title}`, k)));
  if (problems.length) return { ok: false, problems };
  const counts = { certifications: seed.certifications.length, learning: seed.learning.length, projects: seed.projects.length };
  if (dryRun) return { ok: true, dryRun: true, counts };

  const fail = (what, error) => { throw new Error(`${what}: ${error.message}`); };
  for (const c of seed.certifications) {
    const { data, error } = await client.from("certification_catalog").upsert({ name: c.name, provider: c.provider, difficulty: c.difficulty ?? null, url: c.url ?? null, cost: c.cost ?? null, duration: c.duration ?? null, eligibility: c.eligibility ?? null, is_active: c.isActive ?? true }, { onConflict: "provider,name" }).select("id").single();
    if (error) fail(`certification ${c.name}`, error);
    await client.from("certification_skills").delete().eq("certification_id", data.id);
    await client.from("certification_careers").delete().eq("certification_id", data.id);
    const a = await client.from("certification_skills").insert(c.skills.map((k) => ({ certification_id: data.id, skill_id: skillId.get(k) })));
    if (a.error) fail(`certification ${c.name} skills`, a.error);
    const b = await client.from("certification_careers").insert(c.careers.map((x) => ({ certification_id: data.id, career_id: careerId.get(x.career), relevance: x.relevance })));
    if (b.error) fail(`certification ${c.name} careers`, b.error);
  }
  for (const l of seed.learning) {
    const { data, error } = await client.from("learning_catalog").upsert({ title: l.title, provider: l.provider, url: l.url ?? null, level_from: l.levelFrom, level_to: l.levelTo, estimated_hours: l.estimatedHours ?? null, prerequisites: l.prerequisites ?? [], is_active: l.isActive ?? true }, { onConflict: "provider,title" }).select("id").single();
    if (error) fail(`learning ${l.title}`, error);
    await client.from("learning_item_skills").delete().eq("item_id", data.id);
    const s = await client.from("learning_item_skills").insert(l.skills.map((k) => ({ item_id: data.id, skill_id: skillId.get(k) })));
    if (s.error) fail(`learning ${l.title} skills`, s.error);
  }
  for (const p of seed.projects) {
    // projects have no natural unique key: match an existing general project by title + source
    const { data: existing } = await client.from("project_catalog").select("id").eq("title", p.title).eq("source", p.source).is("institution_id", null).is("for_student_id", null).maybeSingle();
    const row = { title: p.title, description: p.description, difficulty: p.difficulty, expected_evidence: p.expectedEvidence ?? [], source: p.source, status: p.status ?? "ACTIVE" };
    const res = existing ? await client.from("project_catalog").update(row).eq("id", existing.id).select("id").single() : await client.from("project_catalog").insert(row).select("id").single();
    if (res.error) fail(`project ${p.title}`, res.error);
    await client.from("project_skills").delete().eq("project_id", res.data.id);
    const s = await client.from("project_skills").insert(p.skills.map((k) => ({ project_id: res.data.id, skill_id: skillId.get(k) })));
    if (s.error) fail(`project ${p.title} skills`, s.error);
  }
  return { ok: true, counts };
}
