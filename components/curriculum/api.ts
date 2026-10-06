/** Tiny fetch wrapper for the curriculum admin API: always resolves, never throws, and gives back the server's own error text. */
export type ApiResult<T> = { ok: true; data: T } | { ok: false; error: string };

export async function api<T = Record<string, unknown>>(method: "POST" | "PUT" | "PATCH" | "DELETE", url: string, body?: unknown): Promise<ApiResult<T>> {
  try {
    const res = await fetch(url, { method, headers: body === undefined ? undefined : { "Content-Type": "application/json" }, body: body === undefined ? undefined : JSON.stringify(body) });
    const json = (await res.json().catch(() => null)) as (T & { error?: string }) | null;
    if (!res.ok) return { ok: false, error: json?.error ?? (res.status === 403 ? "You don't have permission to do that." : res.status === 429 ? "Too many requests — wait a moment and try again." : "Something went wrong. Please try again.") };
    return { ok: true, data: (json ?? {}) as T };
  } catch {
    return { ok: false, error: "Couldn't reach the server. Check your connection and try again." };
  }
}
