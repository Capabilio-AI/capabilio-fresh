// TEST SUPPORT: a tiny in-memory stand-in for the Supabase query builder, enough for the calls the recruiter code makes. Never imported by app code.
type Row = Record<string, unknown>;

export function fakeDb(tables: Record<string, Row[]>) {
  const from = (name: string) => {
    const rows = (tables[name] ??= []);
    let pending: Row[] = rows;
    let mode: "select" | "update" | "insert" = "select";
    let patch: Row = {};
    let inserted: Row | null = null;
    const api: Record<string, unknown> = {
      select: () => api,
      eq: (c: string, v: unknown) => ((pending = pending.filter((r) => r[c] === v)), api),
      in: (c: string, vs: unknown[]) => ((pending = pending.filter((r) => vs.includes(r[c]))), api),
      is: (c: string, v: unknown) => ((pending = pending.filter((r) => (r[c] ?? null) === v)), api),
      order: () => api,
      limit: () => api,
      insert: (r: Row) => {
        mode = "insert";
        inserted = { id: `id-${rows.length + 1}`, view_count: 0, revoked_at: null, last_viewed_at: null, created_at: new Date().toISOString(), ...r };
        rows.push(inserted);
        return api;
      },
      update: (p: Row) => ((mode = "update"), (patch = p), api),
      maybeSingle: async () => ({ data: pending[0] ?? null, error: null }),
      single: async () => ({ data: mode === "insert" ? inserted : (pending[0] ?? null), error: null }),
      then: (resolve: (v: unknown) => void) => {
        if (mode === "update") for (const r of pending) Object.assign(r, patch);
        resolve({ data: pending, error: null });
      },
    };
    return api;
  };
  return { from } as never;
}
