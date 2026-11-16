import { randomUUID } from "node:crypto";
import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import type { ProEmploymentRow } from "./work";
import { categoryFor, type ProSkill, type SkillLevel, type SkillValue } from "./skills";
import { DOC_KINDS, safeName, titleFrom, type DocKind, type Share } from "./documents";
import type { ApplicationValue, FeedbackValue, Outcome, Round, Stage } from "./tracker";

const db = () => untyped(createServiceClient());
const BUCKET = "pro-documents";
export type Result = { ok: true } | { ok: false; status: number; message: string };
const fail = (status: number, message: string): Result => ({ ok: false, status, message });
const SAVE = "That did not save. Try again.";

// ---- skills ----
interface SkillRow { id: string; name: string; category: string | null; level: SkillLevel; source: "resume" | "added" }

/** The skill graph: every skill with the jobs it was used in. Errors surface to the caller so a page can say so plainly. */
export async function listSkills(userId: string): Promise<{ skills: ProSkill[]; jobs: ProEmploymentRow[] }> {
  const [skills, jobs] = await Promise.all([
    db().from("pro_skills").select("id, name, category, level, source").eq("user_id", userId).order("name"),
    db().from("pro_employment").select("id, employer_name, job_title, start_date, end_date, period_text, description, source").eq("user_id", userId),
  ]);
  if (skills.error) throw skills.error;
  const rows = (skills.data ?? []) as SkillRow[];
  const links = rows.length ? await db().from("pro_skill_jobs").select("skill_id, employment_id").in("skill_id", rows.map((r) => r.id)) : { data: [] };
  const by = new Map<string, string[]>();
  for (const l of (links.data ?? []) as { skill_id: string; employment_id: string }[]) by.set(l.skill_id, [...(by.get(l.skill_id) ?? []), l.employment_id]);
  return {
    skills: rows.map((r) => ({ id: r.id, name: r.name, category: r.category ?? categoryFor(r.name), level: r.level, source: r.source, jobIds: by.get(r.id) ?? [] })),
    jobs: (jobs.data ?? []) as ProEmploymentRow[],
  };
}

async function ownJobIds(userId: string, ids: string[]): Promise<string[]> {
  if (!ids.length) return [];
  const { data } = await db().from("pro_employment").select("id").eq("user_id", userId).in("id", ids);
  return ((data ?? []) as { id: string }[]).map((r) => r.id);
}

async function setLinks(skillId: string, userId: string, jobIds: string[]): Promise<boolean> {
  const own = await ownJobIds(userId, jobIds);
  const del = await db().from("pro_skill_jobs").delete().eq("skill_id", skillId);
  if (del.error) return false;
  if (!own.length) return true;
  return !(await db().from("pro_skill_jobs").insert(own.map((employment_id) => ({ skill_id: skillId, employment_id })))).error;
}

export async function addSkill(userId: string, v: SkillValue): Promise<Result> {
  const { data, error } = await db().from("pro_skills").insert({ user_id: userId, name: v.name, category: v.category, level: v.level, source: "added" }).select("id").single();
  if (error?.code === "23505") return fail(409, "That skill is already on your graph.");
  if (error || !data) return fail(500, SAVE);
  return (await setLinks((data as { id: string }).id, userId, v.jobIds)) ? { ok: true } : fail(500, SAVE);
}

export async function updateSkill(userId: string, skillId: string, v: SkillValue): Promise<Result> {
  const { data, error } = await db().from("pro_skills").update({ name: v.name, category: v.category, level: v.level }).eq("id", skillId).eq("user_id", userId).select("id");
  if (error?.code === "23505") return fail(409, "You already have a skill with that name.");
  if (error) return fail(500, SAVE);
  if (!(data ?? []).length) return fail(404, "That skill is not on your graph.");
  return (await setLinks(skillId, userId, v.jobIds)) ? { ok: true } : fail(500, SAVE);
}

export async function removeSkill(userId: string, skillId: string): Promise<Result> {
  const { data, error } = await db().from("pro_skills").delete().eq("id", skillId).eq("user_id", userId).select("id");
  return error ? fail(500, SAVE) : (data ?? []).length ? { ok: true } : fail(404, "That skill is not on your graph.");
}

/** Skills read from a resume, added without touching the ones the person already has. Never blocks saving the resume. */
export async function seedResumeSkills(userId: string, names: readonly string[]): Promise<void> {
  try {
    const wanted = [...new Map(names.map((n) => [n.trim().toLowerCase(), n.trim().slice(0, 60)] as const).filter(([k]) => k)).values()];
    if (!wanted.length) return;
    const { data } = await db().from("pro_skills").select("name").eq("user_id", userId);
    const have = new Set(((data ?? []) as { name: string }[]).map((r) => r.name.trim().toLowerCase()));
    const rows = wanted.filter((n) => !have.has(n.toLowerCase())).map((name) => ({ user_id: userId, name, category: categoryFor(name), source: "resume" as const }));
    if (rows.length) await db().from("pro_skills").insert(rows);
  } catch (e) {
    console.error("[professional] could not seed resume skills:", (e as Error).message);
  }
}

// ---- documents ----
export interface DocRow { id: string; kind: DocKind; title: string; fileName: string; sizeBytes: number; share: Share; createdAt: string }

export async function listDocs(userId: string): Promise<DocRow[]> {
  const { data, error } = await db().from("pro_documents").select("id, kind, title, file_name, size_bytes, share, created_at").eq("user_id", userId).order("created_at", { ascending: false });
  if (error) throw error;
  return ((data ?? []) as { id: string; kind: DocKind; title: string; file_name: string; size_bytes: number; share: Share; created_at: string }[]).map((d) => ({ id: d.id, kind: d.kind, title: d.title, fileName: d.file_name, sizeBytes: d.size_bytes, share: d.share, createdAt: d.created_at }));
}

/** Stores a checked file in the private bucket and records it. A new resume replaces the old one. */
export async function addDoc(userId: string, kind: DocKind, file: { name: string; bytes: Uint8Array; mime: string; ext: string }): Promise<Result> {
  if (!(DOC_KINDS as readonly string[]).includes(kind)) return fail(400, "Choose what kind of document this is.");
  const path = `${userId}/${randomUUID()}-${safeName(file.name, file.ext)}`;
  const up = await createServiceClient().storage.from(BUCKET).upload(path, file.bytes, { contentType: file.mime, upsert: false });
  if (up.error) return fail(502, "The upload failed. Try again.");
  if (kind === "resume") {
    const { data: old } = await db().from("pro_documents").select("id, storage_path").eq("user_id", userId).eq("kind", "resume");
    for (const o of (old ?? []) as { id: string; storage_path: string }[]) {
      await createServiceClient().storage.from(BUCKET).remove([o.storage_path]);
      await db().from("pro_documents").delete().eq("id", o.id).eq("user_id", userId);
    }
  }
  const ins = await db().from("pro_documents").insert({ user_id: userId, kind, title: titleFrom(file.name), file_name: safeName(file.name, file.ext), storage_path: path, mime: file.mime, size_bytes: file.bytes.length });
  if (ins.error) {
    await createServiceClient().storage.from(BUCKET).remove([path]);
    return fail(500, SAVE);
  }
  return { ok: true };
}

/** A link that works for one minute, for the owner of the document only. */
export async function docLink(userId: string, docId: string): Promise<string | null> {
  const { data } = await db().from("pro_documents").select("storage_path, file_name").eq("id", docId).eq("user_id", userId).maybeSingle();
  const d = data as { storage_path: string; file_name: string } | null;
  if (!d) return null;
  const signed = await createServiceClient().storage.from(BUCKET).createSignedUrl(d.storage_path, 60, { download: d.file_name });
  return signed.data?.signedUrl ?? null;
}

export async function setDocShare(userId: string, docId: string, share: Share): Promise<Result> {
  const { data, error } = await db().from("pro_documents").update({ share }).eq("id", docId).eq("user_id", userId).select("id");
  return error ? fail(500, SAVE) : (data ?? []).length ? { ok: true } : fail(404, "That document was not found.");
}

export async function removeDoc(userId: string, docId: string): Promise<Result> {
  const { data } = await db().from("pro_documents").select("storage_path").eq("id", docId).eq("user_id", userId).maybeSingle();
  const d = data as { storage_path: string } | null;
  if (!d) return fail(404, "That document was not found.");
  await createServiceClient().storage.from(BUCKET).remove([d.storage_path]);
  const del = await db().from("pro_documents").delete().eq("id", docId).eq("user_id", userId);
  return del.error ? fail(500, SAVE) : { ok: true };
}

// ---- applications and feedback ----
export interface AppRow { id: string; company: string; role: string; link: string | null; stage: Stage; appliedOn: string | null; notes: string | null; updatedAt: string }
export interface FeedbackRow { id: string; applicationId: string; round: Round; outcome: Outcome; wentWell: string | null; toImprove: string | null; givenOn: string }

export async function listApplications(userId: string): Promise<{ apps: AppRow[]; feedback: FeedbackRow[] }> {
  const [apps, fb] = await Promise.all([
    db().from("pro_applications").select("id, company, role, link, stage, applied_on, notes, updated_at").eq("user_id", userId).order("updated_at", { ascending: false }).limit(300),
    db().from("pro_application_feedback").select("id, application_id, round, outcome, went_well, to_improve, given_on").eq("user_id", userId).order("given_on", { ascending: false }).limit(500),
  ]);
  if (apps.error) throw apps.error;
  if (fb.error) throw fb.error;
  return {
    apps: ((apps.data ?? []) as { id: string; company: string; role: string; link: string | null; stage: Stage; applied_on: string | null; notes: string | null; updated_at: string }[]).map((a) => ({ id: a.id, company: a.company, role: a.role, link: a.link, stage: a.stage, appliedOn: a.applied_on, notes: a.notes, updatedAt: a.updated_at })),
    feedback: ((fb.data ?? []) as { id: string; application_id: string; round: Round; outcome: Outcome; went_well: string | null; to_improve: string | null; given_on: string }[]).map((f) => ({ id: f.id, applicationId: f.application_id, round: f.round, outcome: f.outcome, wentWell: f.went_well, toImprove: f.to_improve, givenOn: f.given_on })),
  };
}

const MAX_APPLICATIONS = 300;
export async function createApplication(userId: string, v: ApplicationValue): Promise<Result> {
  const { count } = await db().from("pro_applications").select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= MAX_APPLICATIONS) return fail(409, "You have reached the limit of 300 tracked applications.");
  const { error } = await db().from("pro_applications").insert({ user_id: userId, company: v.company, role: v.role, link: v.link, stage: v.stage, applied_on: v.appliedOn, notes: v.notes });
  return error ? fail(500, SAVE) : { ok: true };
}

export async function updateApplication(userId: string, id: string, patch: { stage?: Stage; notes?: string | null }): Promise<Result> {
  const { data, error } = await db().from("pro_applications").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id).eq("user_id", userId).select("id");
  return error ? fail(500, SAVE) : (data ?? []).length ? { ok: true } : fail(404, "That application was not found.");
}

export async function deleteApplication(userId: string, id: string): Promise<Result> {
  const { data, error } = await db().from("pro_applications").delete().eq("id", id).eq("user_id", userId).select("id");
  return error ? fail(500, SAVE) : (data ?? []).length ? { ok: true } : fail(404, "That application was not found.");
}

export async function addFeedback(userId: string, v: FeedbackValue): Promise<Result> {
  const { data } = await db().from("pro_applications").select("id").eq("id", v.applicationId).eq("user_id", userId).maybeSingle();
  if (!data) return fail(404, "That application was not found.");
  const { error } = await db().from("pro_application_feedback").insert({ application_id: v.applicationId, user_id: userId, round: v.round, outcome: v.outcome, went_well: v.wentWell, to_improve: v.toImprove, given_on: v.givenOn });
  return error ? fail(500, SAVE) : { ok: true };
}

export async function deleteFeedback(userId: string, id: string): Promise<Result> {
  const { data, error } = await db().from("pro_application_feedback").delete().eq("id", id).eq("user_id", userId).select("id");
  return error ? fail(500, SAVE) : (data ?? []).length ? { ok: true } : fail(404, "That feedback was not found.");
}
