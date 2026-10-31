/**
 * Reads rows for many ids in chunks. PostgREST returns at most 1000 rows per request and does not say when it cut the list, so a single
 * `.in("course_id", allIds)` over a big curriculum silently loses mappings; a lost mapping is a subject that looks "not tracked" to a student.
 */
export async function selectInChunks<T>(ids: readonly string[], fetchChunk: (chunk: string[]) => PromiseLike<{ data: T[] | null }>, size = 25): Promise<T[]> {
  const out: T[] = [];
  for (let i = 0; i < ids.length; i += size) {
    const { data } = await fetchChunk(ids.slice(i, i + size) as string[]);
    out.push(...(data ?? []));
  }
  return out;
}
