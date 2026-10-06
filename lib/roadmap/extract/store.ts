import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { untyped } from "@/lib/org/db";
import { ExtractionResultSchema, type ExtractionErrorCode, type ExtractionRecord } from "./types";

type Service = SupabaseClient<Database>;

/** A job whose instance died never reports back; past this it is shown as failed so the admin can retry. */
export const STALE_AFTER_MS = 10 * 60_000;
const KEEP_DAYS = 7;

interface Row {
  id: string;
  branch: string;
  file_name: string;
  status: "processing" | "ready" | "failed";
  chunks_done: number;
  chunks_total: number;
  error_code: ExtractionErrorCode | null;
  result: unknown;
  created_at: string;
  updated_at: string;
}
const COLUMNS = "id, branch, file_name, status, chunks_done, chunks_total, error_code, result, created_at, updated_at";

export function toRecord(row: Row, now = Date.now()): ExtractionRecord {
  const stale = row.status === "processing" && now - new Date(row.updated_at).getTime() > STALE_AFTER_MS;
  const parsed = row.status === "ready" ? ExtractionResultSchema.safeParse(row.result) : null;
  return {
    id: row.id,
    branch: row.branch,
    fileName: row.file_name,
    status: stale ? "failed" : row.status,
    chunksDone: row.chunks_done,
    chunksTotal: row.chunks_total,
    errorCode: stale ? "internal" : row.error_code,
    result: parsed?.success ? parsed.data : null,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Always scoped to the admin's own institution AND to their own upload. */
export async function getExtraction(service: Service, institutionId: string, userId: string, id: string): Promise<ExtractionRecord | null> {
  const { data } = await untyped(service).from("curriculum_extractions").select(COLUMNS).eq("id", id).eq("institution_id", institutionId).eq("created_by", userId).maybeSingle();
  return data ? toRecord(data as Row) : null;
}

export async function latestExtraction(service: Service, institutionId: string, userId: string): Promise<ExtractionRecord | null> {
  const { data } = await untyped(service)
    .from("curriculum_extractions")
    .select(COLUMNS)
    .eq("institution_id", institutionId)
    .eq("created_by", userId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data ? toRecord(data as Row) : null;
}

export async function hasActiveJob(service: Service, institutionId: string): Promise<boolean> {
  const since = new Date(Date.now() - STALE_AFTER_MS).toISOString();
  const { count } = await untyped(service).from("curriculum_extractions").select("id", { count: "exact", head: true }).eq("institution_id", institutionId).eq("status", "processing").gte("updated_at", since);
  return (count ?? 0) > 0;
}

export async function createExtraction(service: Service, v: { institutionId: string; userId: string; branch: string; roleKey: string; fileName: string; fileBytes: number }): Promise<string | null> {
  const db = untyped(service);
  await db.from("curriculum_extractions").delete().eq("institution_id", v.institutionId).lt("created_at", new Date(Date.now() - KEEP_DAYS * 86_400_000).toISOString());
  const { data, error } = await db
    .from("curriculum_extractions")
    .insert({ institution_id: v.institutionId, created_by: v.userId, branch: v.branch, role_key: v.roleKey, file_name: v.fileName.slice(0, 300), file_bytes: v.fileBytes })
    .select("id")
    .single();
  return error || !data ? null : (data as { id: string }).id;
}

const WRITE_ATTEMPTS = 3;
const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Updates a staging row, retrying a failed write (an idempotent UPDATE) and THROWING if it still fails — a final "ready"/"failed"
 * write that is silently lost would leave a finished job showing "processing" until it is declared stale.
 */
export async function updateExtraction(service: Service, id: string, patch: Record<string, unknown>): Promise<void> {
  let message = "";
  for (let attempt = 1; attempt <= WRITE_ATTEMPTS; attempt++) {
    const { error } = await untyped(service).from("curriculum_extractions").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", id);
    if (!error) return;
    message = (error as { message?: string }).message ?? "unknown error";
    if (attempt < WRITE_ATTEMPTS) await sleep(300 * attempt);
  }
  throw new Error(`Could not update extraction ${id}: ${message}`);
}

/** Progress is cosmetic: a lost progress write must never abort the job. */
export const reportProgress = (service: Service, id: string, patch: Record<string, unknown>): Promise<void> => updateExtraction(service, id, patch).catch(() => undefined);

export async function deleteExtraction(service: Service, institutionId: string, userId: string, id: string): Promise<boolean> {
  const { data } = await untyped(service).from("curriculum_extractions").delete().eq("id", id).eq("institution_id", institutionId).eq("created_by", userId).select("id, import_id");
  const rows = (data as { id: string; import_id: string | null }[] | null) ?? [];
  // Discarding the staged result also discards its unpublished draft; a published or archived import is never touched.
  const importId = rows[0]?.import_id;
  if (importId) await service.from("curriculum_imports").update({ deleted_at: new Date().toISOString() }).eq("id", importId).eq("institution_id", institutionId).in("status", ["DRAFT", "EXTRACTED", "UNDER_REVIEW", "CONFIRMED"]);
  return rows.length > 0;
}
