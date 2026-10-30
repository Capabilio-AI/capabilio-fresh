/** Pure. True when a Supabase/PostgREST error means the RPC doesn't exist (migration not applied yet): Postgres 42883 or PostgREST PGRST202. */
export function isFunctionMissing(error: { code?: string } | null | undefined): boolean {
  return error?.code === "42883" || error?.code === "PGRST202";
}

export interface AtomicSubmitResult {
  conflict: boolean;
  awarded: boolean;
  completion_id: string | null;
}

/** Pure. Narrows the jsonb the record_stream_completion RPC returns; null when the shape is unexpected. */
export function parseAtomicSubmit(data: unknown): AtomicSubmitResult | null {
  if (!data || typeof data !== "object") return null;
  const d = data as Record<string, unknown>;
  if (typeof d.conflict !== "boolean" || typeof d.awarded !== "boolean") return null;
  return { conflict: d.conflict, awarded: d.awarded, completion_id: typeof d.completion_id === "string" ? d.completion_id : null };
}
