import http from "node:http";
import https from "node:https";
import { createServerClient } from "@supabase/ssr";

// Test support only (*.live.test.ts): talk to a running copy of the app as a signed-in person, with the session cookie in the real format.

export interface RawResponse {
  status: number;
  text: string;
  location: string | null;
}

/**
 * One request on its own connection (no reuse). A long wait on one request can leave a pooled connection that the network has silently dropped, and the
 * next request on it then hangs until it times out; that is a property of the test machine's network, not of the app, so every request starts clean.
 */
export function rawRequest(method: string, url: string, headers: Record<string, string>, body?: string): Promise<RawResponse> {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const lib = u.protocol === "https:" ? https : http;
    const req = lib.request(u, { method, headers: { ...headers, ...(body ? { "content-length": String(Buffer.byteLength(body)) } : {}), connection: "close" }, agent: false }, (res) => {
      const chunks: Buffer[] = [];
      res.on("data", (c: Buffer) => chunks.push(c));
      res.on("end", () => resolve({ status: res.statusCode ?? 0, text: Buffer.concat(chunks).toString("utf8"), location: (res.headers.location as string | undefined) ?? null }));
      res.on("error", reject);
    });
    req.on("error", reject);
    req.setTimeout(600_000, () => req.destroy(Object.assign(new Error("no response in 10 minutes"), { code: "ETIMEDOUT" })));
    if (body) req.write(body);
    req.end();
  });
}

export interface Reply {
  status: number;
  text: string;
  location: string | null;
  json: Record<string, unknown> | null;
}
export type Browser = (method: "GET" | "POST", path: string, body?: unknown) => Promise<Reply>;

const parse = (r: RawResponse): Reply => {
  let json: Record<string, unknown> | null = null;
  try { json = JSON.parse(r.text); } catch { /* a page, not JSON */ }
  return { ...r, json };
};

/** A signed-in person's browser, as far as the server can tell. Pass no login for a visitor. */
export async function browserFor(base: string, login?: { email: string; password: string }): Promise<Browser> {
  let cookie = "";
  if (login) {
    const jar = new Map<string, string>();
    const client = createServerClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY!, {
      cookies: { getAll: () => [...jar].map(([name, value]) => ({ name, value })), setAll: (all) => all.forEach(({ name, value }) => jar.set(name, value)) },
    });
    const { error } = await client.auth.signInWithPassword(login);
    if (error) throw error;
    cookie = [...jar].map(([k, v]) => `${k}=${v}`).join("; ");
  }
  return async (method, path, body) =>
    parse(await rawRequest(method, `${base}${path}`, { ...(cookie ? { cookie } : {}), "content-type": "application/json", origin: base }, body === undefined ? undefined : JSON.stringify(body)));
}
