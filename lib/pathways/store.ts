import { createHash } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import { untyped } from "@/lib/org/db";
import { ContentError } from "@/lib/arena-content/store";
import { PathwaySpec, type PathwayStatus } from "./schema";
import { freshness, pathwayProblems } from "./rules";
import { coverRequests } from "@/lib/goals/covered";

type Service = SupabaseClient;

export interface PathwayRow { id: string; key: string; version: number; name: string; kind: string; status: PathwayStatus; provenance: string; spec: PathwaySpec; reviewedAt: string | null; publishedAt: string | null }
const COLUMNS = "id, key, version, name, kind, status, provenance, spec, reviewed_at, published_at";
type Raw = { id: string; key: string; version: number; name: string; kind: string; status: PathwayStatus; provenance: string; spec: PathwaySpec; reviewed_at: string | null; published_at: string | null };
const toRow = (r: Raw): PathwayRow => ({ id: r.id, key: r.key, version: r.version, name: r.name, kind: r.kind, status: r.status, provenance: r.provenance, spec: r.spec, reviewedAt: r.reviewed_at, publishedAt: r.published_at });

export const specHash = (spec: PathwaySpec): string => createHash("sha256").update(JSON.stringify(spec)).digest("hex");

/** Parses and checks a pathway, throwing every reason at once. Nothing is written. */
export function validatePathway(input: unknown, today: Date = new Date()): PathwaySpec {
  const parsed = PathwaySpec.safeParse(input);
  if (!parsed.success) throw new ContentError(parsed.error.issues.map((i) => `${i.path.join(".") || "pathway"}: ${i.message}`).join("; "));
  const problems = pathwayProblems(parsed.data, today);
  if (problems.length > 0) throw new ContentError(problems.join("; "));
  return parsed.data;
}

/** Saves a valid pathway as a new DRAFT version of its key; the same content as the latest version changes nothing. */
export async function importPathway(service: Service, input: unknown, provenance: "curated" | "ai_drafted" = "curated"): Promise<{ id: string; version: number; created: boolean }> {
  const spec = validatePathway(input);
  const hash = specHash(spec);
  const db = untyped(service);
  const { data: latest } = await db.from("pathways").select("id, version, spec_hash").eq("key", spec.key).order("version", { ascending: false }).limit(1).maybeSingle();
  const prev = latest as { id: string; version: number; spec_hash: string } | null;
  if (prev && prev.spec_hash === hash) return { id: prev.id, version: prev.version, created: false };
  const version = (prev?.version ?? 0) + 1;
  const { data, error } = await db.from("pathways").insert({ key: spec.key, version, name: spec.name, kind: spec.kind, provenance, spec, spec_hash: hash }).select("id").single();
  if (error || !data) throw new ContentError(`Could not save the pathway: ${error?.message ?? "no row"}`, 500);
  return { id: (data as { id: string }).id, version, created: true };
}

async function head(service: Service, id: string): Promise<PathwayRow> {
  const { data, error } = await untyped(service).from("pathways").select(COLUMNS).eq("id", id).maybeSingle();
  if (error) throw error;
  if (!data) throw new ContentError("That pathway does not exist.", 404);
  return toRow(data as Raw);
}

/** A platform admin reviews a draft. It is validated again, so a rule added since the import still applies. */
export async function reviewPathway(service: Service, id: string, adminId: string): Promise<void> {
  const p = await head(service, id);
  if (p.status !== "DRAFT") throw new ContentError("Only a draft can be reviewed.", 409);
  validatePathway(p.spec);
  const { error } = await untyped(service).from("pathways").update({ status: "REVIEWED", reviewed_by: adminId, reviewed_at: new Date().toISOString() }).eq("id", id);
  if (error) throw error;
}

/** Publishes a reviewed pathway and retires the key's earlier published version. Refused while any fact is stale: a student must never read an expired rule as current. */
export async function publishPathway(service: Service, id: string, now: Date = new Date()): Promise<{ covered: number; notified: number }> {
  const p = await head(service, id);
  if (p.status === "PUBLISHED") return { covered: 0, notified: 0 };
  if (p.status !== "REVIEWED") throw new ContentError("A pathway must be reviewed before it is published.", 409);
  const stale = p.spec.facts.filter((f) => freshness(f, now) === "stale").map((f) => f.key);
  if (stale.length > 0) throw new ContentError(`These facts have expired and must be checked again at the official source first: ${stale.join(", ")}`, 409);
  const db = untyped(service);
  await db.from("pathways").update({ status: "RETIRED" }).eq("key", p.key).eq("status", "PUBLISHED");
  const { error } = await db.from("pathways").update({ status: "PUBLISHED", published_at: now.toISOString() }).eq("id", id);
  if (error) throw error;
  // the students who asked for this goal are told once it exists; a failure here never undoes the publish
  return coverRequests(service, { key: p.key, name: p.name, kind: p.kind, aliases: p.spec.aliases ?? [] });
}

export async function retirePathway(service: Service, id: string): Promise<void> {
  const { error } = await untyped(service).from("pathways").update({ status: "RETIRED" }).eq("id", id);
  if (error) throw error;
}

export async function loadPublishedPathway(service: Service, key: string): Promise<PathwayRow | null> {
  const { data, error } = await untyped(service).from("pathways").select(COLUMNS).eq("key", key).eq("status", "PUBLISHED").maybeSingle();
  if (error) throw error;
  return data ? toRow(data as Raw) : null;
}

export async function listPathways(service: Service, statuses: readonly PathwayStatus[] = ["PUBLISHED"]): Promise<Pick<PathwayRow, "id" | "key" | "version" | "name" | "kind" | "status" | "provenance">[]> {
  const { data, error } = await untyped(service).from("pathways").select("id, key, version, name, kind, status, provenance").in("status", statuses as PathwayStatus[]).order("name");
  if (error) throw error;
  return (data ?? []) as Pick<PathwayRow, "id" | "key" | "version" | "name" | "kind" | "status" | "provenance">[];
}

/** The published pathways as the goal box needs them to match what a student typed. */
export async function listPublishedForMatching(service: Service): Promise<{ key: string; name: string; kind: string; aliases: string[] }[]> {
  const { data, error } = await untyped(service).from("pathways").select("key, name, kind, spec").eq("status", "PUBLISHED");
  if (error) throw error;
  return ((data ?? []) as { key: string; name: string; kind: string; spec: { aliases?: string[] } }[]).map((r) => ({ key: r.key, name: r.name, kind: r.kind, aliases: r.spec.aliases ?? [] }));
}

/** The pathway a student chose as their goal, if it is still published. */
export async function loadChosenPathway(service: Service, userId: string): Promise<{ key: string; name: string } | null> {
  const { data } = await untyped(service).from("student_pathway_goal").select("pathway_key").eq("user_id", userId).maybeSingle();
  const key = (data as { pathway_key: string } | null)?.pathway_key;
  if (!key) return null;
  const p = await loadPublishedPathway(service, key);
  return p ? { key: p.key, name: p.name } : null;
}

/** Makes a published pathway the student's goal (replacing any earlier one). Refuses a pathway that is not published. */
export async function choosePathway(service: Service, userId: string, key: string): Promise<boolean> {
  if (!(await loadPublishedPathway(service, key))) return false;
  const { error } = await untyped(service).from("student_pathway_goal").upsert({ user_id: userId, pathway_key: key, chosen_at: new Date().toISOString() }, { onConflict: "user_id" });
  if (error) throw error;
  return true;
}

export async function clearChosenPathway(service: Service, userId: string): Promise<void> {
  const { error } = await untyped(service).from("student_pathway_goal").delete().eq("user_id", userId);
  if (error) throw error;
}
