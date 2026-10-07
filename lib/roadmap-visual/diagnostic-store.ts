import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { loadStudentCapabilities } from "@/lib/capability/read-model";
import { DIAGNOSTIC_FORMULA, ItemSpec, grade, itemProblems, keyOf, nextDifficulty, planSkills, skillResult, type Answered, type Difficulty, type Response, type SkillResult, type StoredKey } from "./diagnostic";

type Service = SupabaseClient<Database>;

export class DiagnosticError extends Error {
  constructor(message: string, readonly status = 400) {
    super(message);
  }
}

// ---------------------------------------------------------------------------------------------------------------- authoring (operators)
export interface ImportReport {
  inserted: number;
  unchanged: number;
  errors: string[];
}

const itemHash = (i: ItemSpec) => createHash("sha256").update(JSON.stringify([i.skill, i.kind, i.difficulty, i.prompt, "options" in i ? i.options : null, keyOf(i)])).digest("hex");

/** Validates every item (shape, answer in range, skill active, easy/medium/hard present) and inserts new ones as DRAFT. An identical item is not inserted twice. */
export async function importItems(service: Service, raw: unknown, createdBy: string | null): Promise<ImportReport> {
  const list = (raw as { items?: unknown[] })?.items;
  const provenance = (raw as { provenance?: unknown })?.provenance;
  const report: ImportReport = { inserted: 0, unchanged: 0, errors: [] };
  if (!Array.isArray(list) || !provenance) return { ...report, errors: ["the file needs a provenance object and an items array"] };
  const parsed: ItemSpec[] = [];
  list.forEach((entry, n) => {
    const r = ItemSpec.safeParse(entry);
    if (!r.success) return report.errors.push(`item ${n + 1}: ${r.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`);
    for (const p of itemProblems(r.data)) report.errors.push(`item ${n + 1} (${r.data.skill}): ${p}`);
    parsed.push(r.data);
  });
  const skills = new Set(parsed.map((p) => p.skill));
  const { data: rows } = await service.from("skills").select("id, name, status").in("name", [...skills]);
  const byName = new Map((rows ?? []).map((s) => [s.name, s]));
  for (const name of skills) {
    const s = byName.get(name);
    if (!s || s.status !== "active") report.errors.push(`skill "${name}" is not an active skill`);
    const diffs = new Set(parsed.filter((p) => p.skill === name).map((p) => p.difficulty));
    if (diffs.size < 3) report.errors.push(`skill "${name}" needs easy, medium and hard items`);
  }
  if (report.errors.length > 0) return report;

  const db = untyped(service);
  const { data: existing } = await db.from("diagnostic_items").select("skill_id, kind, difficulty, prompt, options, answer_key").in("skill_id", [...byName.values()].map((s) => s.id));
  const have = new Set(((existing ?? []) as { skill_id: string; kind: ItemSpec["kind"]; difficulty: Difficulty; prompt: string; options: string[] | null; answer_key: StoredKey }[]).map((e) => `${e.skill_id}|${e.kind}|${e.difficulty}|${e.prompt}|${JSON.stringify(e.options)}|${JSON.stringify(e.answer_key)}`));
  for (const item of parsed) {
    const skillId = byName.get(item.skill)!.id;
    const options = "options" in item ? item.options : null;
    if (have.has(`${skillId}|${item.kind}|${item.difficulty}|${item.prompt}|${JSON.stringify(options)}|${JSON.stringify(keyOf(item))}`)) {
      report.unchanged += 1;
      continue;
    }
    const { error } = await db.from("diagnostic_items").insert({ skill_id: skillId, status: "DRAFT", source: "CAPABILIO", kind: item.kind, difficulty: item.difficulty, prompt: item.prompt, options, answer_key: keyOf(item), explanation: item.explanation, estimated_seconds: item.seconds, provenance: { ...(provenance as object), hash: itemHash(item) }, created_by: createdBy });
    if (error) report.errors.push(`${item.skill}: ${error.message}`);
    else report.inserted += 1;
  }
  return report;
}

/** DRAFT → PUBLISHED, recording the named admin as reviewer (the database refuses a published item without one). */
export async function publishItems(service: Service, adminId: string, skillNames?: string[]): Promise<number> {
  const db = untyped(service);
  let q = db.from("diagnostic_items").update({ status: "PUBLISHED", reviewed_by: adminId, reviewed_at: new Date().toISOString() }, { count: "exact" }).eq("status", "DRAFT");
  if (skillNames?.length) {
    const { data } = await service.from("skills").select("id").in("name", skillNames);
    q = q.in("skill_id", (data ?? []).map((s) => s.id));
  }
  const { error, count } = await q;
  if (error) throw error;
  return count ?? 0;
}

// ---------------------------------------------------------------------------------------------------------------- the student's check
export interface PublicQuestion {
  id: string;
  skill: string;
  kind: ItemSpec["kind"];
  difficulty: Difficulty;
  prompt: string;
  options: string[] | null;
  seconds: number;
}
export interface DiagnosticSnapshot {
  state: "UNAVAILABLE" | "NOT_STARTED" | "IN_PROGRESS" | "COMPLETED" | "SKIPPED";
  /** UNAVAILABLE: why */
  reason?: "NO_CAREER" | "NO_TEMPLATE" | "NO_ITEMS" | "ALREADY_ASSESSED";
  sessionId?: string;
  question?: PublicQuestion | null;
  progress?: { skillsDone: number; skillsTotal: number };
  results?: { skill: string; level: number; answered: number; correct: number; confidence: "low" | "medium" }[];
  formula: string;
  /** topics that would be checked, so the student knows what they are agreeing to */
  covers?: string[];
}

interface Session { id: string; student_id: string; career_id: string; status: "IN_PROGRESS" | "COMPLETED" | "SKIPPED"; plan: string[] }
interface ItemRow { id: string; skill_id: string; kind: ItemSpec["kind"]; difficulty: Difficulty; prompt: string; options: string[] | null; answer_key: StoredKey; explanation: string | null; estimated_seconds: number }
interface AnswerRow { item_id: string; skill_id: string; difficulty: Difficulty; is_correct: boolean }

const pick = (items: ItemRow[], seed: string) => [...items].sort((a, b) => createHash("sha1").update(seed + a.id).digest("hex").localeCompare(createHash("sha1").update(seed + b.id).digest("hex")))[0];

async function publishedItemsBySkill(service: Service, skillIds: string[]) {
  if (skillIds.length === 0) return new Map<string, ItemRow[]>();
  const { data } = await untyped(service).from("diagnostic_items").select("id, skill_id, kind, difficulty, prompt, options, answer_key, explanation, estimated_seconds").eq("status", "PUBLISHED").in("skill_id", skillIds);
  const m = new Map<string, ItemRow[]>();
  for (const r of (data ?? []) as ItemRow[]) m.set(r.skill_id, [...(m.get(r.skill_id) ?? []), r]);
  return m;
}

/** The next question of an open session, or null when every planned skill is finished. Deterministic, so a reload shows the same question. */
async function nextQuestion(service: Service, s: Session): Promise<{ item: ItemRow; skillsDone: number } | null> {
  const [items, { data: answers }] = await Promise.all([publishedItemsBySkill(service, s.plan), untyped(service).from("diagnostic_answers").select("item_id, skill_id, difficulty, is_correct").eq("session_id", s.id)]);
  const rows = (answers ?? []) as AnswerRow[];
  let done = 0;
  for (const skillId of s.plan) {
    const mine = rows.filter((a) => a.skill_id === skillId);
    const pool = items.get(skillId) ?? [];
    const answered: Answered[] = mine.map((a) => ({ difficulty: a.difficulty, correct: a.is_correct }));
    const d = nextDifficulty(answered, [...new Set(pool.map((p) => p.difficulty))]);
    if (d === null) {
      done += 1;
      continue;
    }
    const used = new Set(mine.map((a) => a.item_id));
    const candidates = pool.filter((p) => p.difficulty === d && !used.has(p.id));
    if (candidates.length) return { item: pick(candidates, s.id + skillId), skillsDone: done };
    done += 1;
  }
  return null;
}

const toPublic = (i: ItemRow, skill: string): PublicQuestion => ({ id: i.id, skill, kind: i.kind, difficulty: i.difficulty, prompt: i.prompt, options: i.options, seconds: i.estimated_seconds });

async function topicsOfCareer(service: Service, careerId: string) {
  const db = untyped(service);
  const { data: t } = await db.from("roadmap_templates").select("id").eq("career_id", careerId).eq("status", "PUBLISHED").maybeSingle();
  if (!t) return null;
  const { data } = await db.from("roadmap_nodes").select("skill_id, importance, target_level").eq("template_id", t.id).eq("type", "TOPIC");
  return ((data ?? []) as { skill_id: string; importance: "CORE" | "RECOMMENDED" | "OPTIONAL"; target_level: number }[]).map((n) => ({ skillId: n.skill_id, importance: n.importance, target: n.target_level }));
}

const skillNames = async (service: Service, ids: string[]) => new Map(((ids.length ? (await service.from("skills").select("id, name").in("id", ids)).data : []) ?? []).map((s) => [s.id, s.name]));

async function resultsOf(service: Service, s: Session) {
  const { data } = await untyped(service).from("diagnostic_answers").select("skill_id, difficulty, is_correct").eq("session_id", s.id);
  const names = await skillNames(service, s.plan);
  return s.plan.flatMap((skillId) => {
    const r = skillResult(((data ?? []) as AnswerRow[]).filter((a) => a.skill_id === skillId).map((a) => ({ difficulty: a.difficulty, correct: a.is_correct })));
    return r ? [{ skill: names.get(skillId) ?? skillId, ...r }] : [];
  });
}

export async function getDiagnostic(service: Service, userId: string, careerId: string | null): Promise<DiagnosticSnapshot> {
  const base = { formula: DIAGNOSTIC_FORMULA };
  if (!careerId) return { ...base, state: "UNAVAILABLE", reason: "NO_CAREER" };
  const db = untyped(service);
  const { data: latest } = await db.from("diagnostic_sessions").select("id, student_id, career_id, status, plan").eq("student_id", userId).eq("career_id", careerId).order("started_at", { ascending: false }).limit(1).maybeSingle();
  const s = latest as Session | null;
  if (s?.status === "IN_PROGRESS") {
    const next = await nextQuestion(service, s);
    const names = await skillNames(service, s.plan);
    return { ...base, state: "IN_PROGRESS", sessionId: s.id, question: next ? toPublic(next.item, names.get(next.item.skill_id) ?? "") : null, progress: { skillsDone: next?.skillsDone ?? s.plan.length, skillsTotal: s.plan.length } };
  }
  if (s?.status === "COMPLETED") return { ...base, state: "COMPLETED", sessionId: s.id, results: await resultsOf(service, s) };
  if (s?.status === "SKIPPED") return { ...base, state: "SKIPPED", sessionId: s.id };
  const plan = await planFor(service, userId, careerId, false);
  if (plan.reason) return { ...base, state: "UNAVAILABLE", reason: plan.reason };
  return { ...base, state: "NOT_STARTED", covers: [...(await skillNames(service, plan.skills)).values()] };
}

async function planFor(service: Service, userId: string, careerId: string, retake: boolean): Promise<{ skills: string[]; reason?: "NO_TEMPLATE" | "NO_ITEMS" | "ALREADY_ASSESSED" }> {
  const topics = await topicsOfCareer(service, careerId);
  if (!topics) return { skills: [], reason: "NO_TEMPLATE" };
  const items = await publishedItemsBySkill(service, [...new Set(topics.map((t) => t.skillId))]);
  const withItems = new Set([...items].filter(([, v]) => new Set(v.map((i) => i.difficulty)).size >= 2).map(([k]) => k));
  if (withItems.size === 0) return { skills: [], reason: "NO_ITEMS" };
  const caps = retake ? null : await loadStudentCapabilities(service, userId);
  const assessed = new Set([...(caps?.bySkill ?? [])].filter(([, c]) => c.level !== null).map(([id]) => id));
  const skills = planSkills(topics, withItems, assessed);
  return skills.length ? { skills } : { skills, reason: "ALREADY_ASSESSED" };
}

/** Starts the check (or resumes the open one). Skills already shown by real evidence are not re-asked unless `retake`. */
export async function startDiagnostic(service: Service, userId: string, careerId: string, retake = false): Promise<DiagnosticSnapshot> {
  const db = untyped(service);
  const { data: open } = await db.from("diagnostic_sessions").select("id").eq("student_id", userId).eq("career_id", careerId).eq("status", "IN_PROGRESS").maybeSingle();
  if (!open) {
    const plan = await planFor(service, userId, careerId, retake);
    if (plan.reason) throw new DiagnosticError(plan.reason === "ALREADY_ASSESSED" ? "You already have evidence for every topic we can check." : "There is no check available for this career yet.", 409);
    const { error } = await db.from("diagnostic_sessions").insert({ student_id: userId, career_id: careerId, plan: plan.skills });
    if (error && !/diagnostic_one_open/.test(error.message)) throw error; // a double click: the other request created it
  }
  return getDiagnostic(service, userId, careerId);
}

/** Skipping records the decision and writes nothing: the topics stay "not assessed". */
export async function skipDiagnostic(service: Service, userId: string, careerId: string): Promise<void> {
  const db = untyped(service);
  const { data: open } = await db.from("diagnostic_sessions").select("id").eq("student_id", userId).eq("career_id", careerId).eq("status", "IN_PROGRESS").maybeSingle();
  if (open) {
    const { error } = await db.from("diagnostic_sessions").update({ status: "SKIPPED", completed_at: new Date().toISOString() }).eq("id", open.id);
    if (error) throw error;
    return;
  }
  const { error } = await db.from("diagnostic_sessions").insert({ student_id: userId, career_id: careerId, plan: [], status: "SKIPPED", completed_at: new Date().toISOString() });
  if (error) throw error;
}

export interface AnswerOutcome {
  correct: boolean;
  explanation: string | null;
  snapshot: DiagnosticSnapshot;
}

export async function answerDiagnostic(service: Service, userId: string, careerId: string, itemId: string, response: Response): Promise<AnswerOutcome> {
  const db = untyped(service);
  const { data: s } = await db.from("diagnostic_sessions").select("id, student_id, career_id, status, plan").eq("student_id", userId).eq("career_id", careerId).eq("status", "IN_PROGRESS").maybeSingle();
  const session = s as Session | null;
  if (!session) throw new DiagnosticError("There is no check in progress.", 409);
  const next = await nextQuestion(service, session);
  // only the question the session is waiting for can be answered: no replays, no cherry-picking
  if (!next || next.item.id !== itemId) throw new DiagnosticError("That isn't the current question.", 409);
  const correct = grade(next.item.kind, next.item.answer_key, response);
  const { error } = await db.from("diagnostic_answers").insert({ session_id: session.id, item_id: itemId, skill_id: next.item.skill_id, difficulty: next.item.difficulty, response, is_correct: correct });
  if (error) throw error;
  const after = await nextQuestion(service, session);
  if (!after) await completeDiagnostic(service, userId, session);
  return { correct, explanation: next.item.explanation, snapshot: await getDiagnostic(service, userId, careerId) };
}

/** Closes the session and records each skill's level as an ordinary assessment result (read by the capability score like any other). */
async function completeDiagnostic(service: Service, userId: string, session: Session): Promise<SkillResult[]> {
  const db = untyped(service);
  const { data } = await db.from("diagnostic_answers").select("skill_id, difficulty, is_correct").eq("session_id", session.id);
  const { data: skills } = await service.from("skills").select("id, name, domain").in("id", session.plan);
  const written: SkillResult[] = [];
  for (const sk of skills ?? []) {
    const r = skillResult(((data ?? []) as AnswerRow[]).filter((a) => a.skill_id === sk.id).map((a) => ({ difficulty: a.difficulty, correct: a.is_correct })));
    if (!r) continue;
    const { data: had } = await service.from("capabilities").select("id").eq("user_id", userId).eq("skill", sk.name).maybeSingle();
    const { error } = await service.from("capabilities").upsert({ user_id: userId, skill: sk.name, domain: sk.domain ?? "General", capability_score: r.level, confidence: r.confidence, data_points: r.answered, updated_at: new Date().toISOString() }, { onConflict: "user_id,skill" });
    if (error) throw error;
    await service.from("capability_history").insert({ user_id: userId, skill: sk.name, capability_score: r.level, confidence: r.confidence, source: had ? "reassessment" : "initial_assessment" });
    written.push(r);
  }
  const { error } = await db.from("diagnostic_sessions").update({ status: "COMPLETED", completed_at: new Date().toISOString() }).eq("id", session.id);
  if (error) throw error;
  return written;
}
