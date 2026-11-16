import { untyped } from "@/lib/org/db";
import { createServiceClient } from "@/lib/supabase/service";
import type { Cert, Edu, Link, Project, ResumeRecords } from "./records";

const db = () => untyped(createServiceClient());

export type Stored<T> = T & { id: string; source: "resume" | "added" };
export interface RecordLists { certifications: Stored<Cert>[]; education: Stored<Edu>[]; projects: Stored<Project>[]; links: Stored<Link>[] }
export type Kind = "certification" | "education" | "project" | "link";
export const KINDS: readonly Kind[] = ["certification", "education", "project", "link"];
export const isKind = (v: unknown): v is Kind => typeof v === "string" && (KINDS as readonly string[]).includes(v);

const TABLE: Record<Kind, string> = { certification: "pro_certifications", education: "pro_education", project: "pro_projects", link: "pro_links" };

/** The four lists from the professional's own tables. Throws when they cannot be read, so a caller can fall back and say so. */
export async function listRecords(userId: string): Promise<RecordLists> {
  const [c, e, p, l] = await Promise.all([
    db().from("pro_certifications").select("id, name, issuer, year, source").eq("user_id", userId).order("year", { ascending: false, nullsFirst: false }),
    db().from("pro_education").select("id, institution, degree, field_of_study, start_year, end_year, source").eq("user_id", userId).order("end_year", { ascending: false, nullsFirst: false }),
    db().from("pro_projects").select("id, name, description, url, skills, source").eq("user_id", userId).order("created_at", { ascending: false }),
    db().from("pro_links").select("id, label, url, source").eq("user_id", userId).order("created_at"),
  ]);
  for (const r of [c, e, p, l]) if (r.error) throw r.error;
  return {
    certifications: ((c.data ?? []) as { id: string; name: string; issuer: string | null; year: number | null; source: "resume" | "added" }[]).map((r) => ({ id: r.id, name: r.name, issuer: r.issuer, year: r.year, source: r.source })),
    education: ((e.data ?? []) as { id: string; institution: string; degree: string | null; field_of_study: string | null; start_year: number | null; end_year: number | null; source: "resume" | "added" }[]).map((r) => ({ id: r.id, institution: r.institution, degree: r.degree, fieldOfStudy: r.field_of_study, startYear: r.start_year, endYear: r.end_year, source: r.source })),
    projects: ((p.data ?? []) as { id: string; name: string; description: string | null; url: string | null; skills: string[]; source: "resume" | "added" }[]).map((r) => ({ id: r.id, name: r.name, description: r.description, url: r.url, skills: r.skills, source: r.source })),
    links: ((l.data ?? []) as { id: string; label: string; url: string; source: "resume" | "added" }[]).map((r) => ({ id: r.id, label: r.label, url: r.url, source: r.source })),
  };
}

/** A resume was read: its records replace the earlier resume's, and everything the person added themselves is left alone. */
export async function replaceResumeRecords(userId: string, r: ResumeRecords): Promise<void> {
  for (const kind of KINDS) {
    const del = await db().from(TABLE[kind]).delete().eq("user_id", userId).eq("source", "resume");
    if (del.error) throw del.error;
  }
  const inserts = [
    r.certifications.length && db().from("pro_certifications").insert(r.certifications.map((c) => ({ user_id: userId, name: c.name, issuer: c.issuer, year: c.year, source: "resume" }))),
    r.education.length && db().from("pro_education").insert(r.education.map((e) => ({ user_id: userId, institution: e.institution, degree: e.degree, field_of_study: e.fieldOfStudy, start_year: e.startYear, end_year: e.endYear, source: "resume" }))),
    r.projects.length && db().from("pro_projects").insert(r.projects.map((p) => ({ user_id: userId, name: p.name, description: p.description, url: p.url, skills: p.skills, source: "resume" }))),
    r.links.length && db().from("pro_links").insert(r.links.map((l) => ({ user_id: userId, label: l.label, url: l.url, source: "resume" }))),
  ].filter(Boolean) as PromiseLike<{ error: unknown }>[];
  for (const res of await Promise.all(inserts)) if (res.error) throw res.error;
}

const LIMIT = 50;
export type Result = { ok: true } | { ok: false; status: number; message: string };

/** One record the professional added by hand. */
export async function addRecord(userId: string, kind: Kind, value: Cert | Edu | Project | Link): Promise<Result> {
  const { count } = await db().from(TABLE[kind]).select("id", { count: "exact", head: true }).eq("user_id", userId);
  if ((count ?? 0) >= LIMIT) return { ok: false, status: 409, message: `You have reached the limit of ${LIMIT} entries here.` };
  const row =
    kind === "certification" ? { name: (value as Cert).name, issuer: (value as Cert).issuer, year: (value as Cert).year }
    : kind === "education" ? { institution: (value as Edu).institution, degree: (value as Edu).degree, field_of_study: (value as Edu).fieldOfStudy, start_year: (value as Edu).startYear, end_year: (value as Edu).endYear }
    : kind === "project" ? { name: (value as Project).name, description: (value as Project).description, url: (value as Project).url, skills: (value as Project).skills }
    : { label: (value as Link).label, url: (value as Link).url };
  const { error } = await db().from(TABLE[kind]).insert({ user_id: userId, ...row, source: "added" });
  return error ? { ok: false, status: 500, message: "That did not save. Try again." } : { ok: true };
}

export async function removeRecord(userId: string, kind: Kind, id: string): Promise<Result> {
  const { data, error } = await db().from(TABLE[kind]).delete().eq("id", id).eq("user_id", userId).select("id");
  return error ? { ok: false, status: 500, message: "That did not save. Try again." } : (data ?? []).length ? { ok: true } : { ok: false, status: 404, message: "That entry was not found." };
}
