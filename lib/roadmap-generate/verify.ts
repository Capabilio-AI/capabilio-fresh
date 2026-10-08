import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Checks the AI proposes links the server will fetch, so this file is the SSRF boundary: https only, no credentials or odd ports, the host must resolve
 * to public addresses only, and every redirect hop is checked again.
 */
export function isPrivateAddress(ip: string): boolean {
  const v6 = ip.toLowerCase();
  if (isIP(ip) === 4) {
    const [a, b] = ip.split(".").map(Number);
    return a === 0 || a === 10 || a === 127 || (a === 100 && b >= 64 && b <= 127) || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 192 && b === 0) || a >= 224;
  }
  if (v6.startsWith("::ffff:")) return isPrivateAddress(v6.slice(7));
  return v6 === "::" || v6 === "::1" || v6.startsWith("fc") || v6.startsWith("fd") || v6.startsWith("fe8") || v6.startsWith("fe9") || v6.startsWith("fea") || v6.startsWith("feb") || v6.startsWith("ff");
}

export type Resolver = (host: string) => Promise<string[]>;
const resolveAll: Resolver = async (host) => (await lookup(host, { all: true })).map((r) => r.address);

export async function isSafePublicUrl(raw: string, resolve: Resolver = resolveAll): Promise<boolean> {
  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return false;
  }
  if (url.protocol !== "https:" || url.username || url.password || (url.port && url.port !== "443")) return false;
  const host = url.hostname.replace(/^\[|\]$/g, "");
  if (host === "localhost" || host.endsWith(".localhost") || host.endsWith(".internal") || host.endsWith(".local")) return false;
  if (isIP(host)) return !isPrivateAddress(host);
  try {
    const addresses = await resolve(host);
    return addresses.length > 0 && addresses.every((a) => !isPrivateAddress(a));
  } catch {
    return false;
  }
}

const GENERIC = new Set(["certified", "certification", "certificate", "professional", "associate", "specialty", "exam", "foundation", "foundations", "fundamentals", "essentials", "training", "course", "the", "and", "for", "with", "from", "online", "program", "programme", "level"]);

/** The words of a certification's name that tell it apart from every other (provider words and generic ones removed). */
export function distinctiveWords(name: string, provider: string): string[] {
  const providerWords = new Set(provider.toLowerCase().split(/[^a-z0-9+#]+/).filter(Boolean));
  return [...new Set(name.toLowerCase().split(/[^a-z0-9+#]+/).filter((w) => w.length >= 3 && !GENERIC.has(w) && !providerWords.has(w)))];
}

/** Pure. Does the page genuinely talk about this certification? At least 60% of its distinctive name words (or the whole name) must appear. */
export function pageMentionsCertification(html: string, name: string, provider: string): boolean {
  const text = html.toLowerCase();
  if (text.includes(name.toLowerCase())) return true;
  const words = distinctiveWords(name, provider);
  if (words.length === 0) return false;
  return words.filter((w) => text.includes(w)).length / words.length >= 0.6;
}

const MAX_HOPS = 3;
const MAX_BYTES = 600_000;

export interface Fetched {
  status: number;
  contentType: string;
  body: string;
}

/** GET with manual redirects: each hop must itself be a safe public https URL. Returns null when anything is unsafe or unreachable. */
export async function safeFetch(rawUrl: string, deps: { fetchImpl?: typeof fetch; resolve?: Resolver } = {}): Promise<Fetched | null> {
  const doFetch = deps.fetchImpl ?? fetch;
  let url = rawUrl;
  for (let hop = 0; hop <= MAX_HOPS; hop++) {
    if (!(await isSafePublicUrl(url, deps.resolve))) return null;
    let res: Response;
    try {
      res = await doFetch(url, { redirect: "manual", signal: AbortSignal.timeout(15_000), headers: { "User-Agent": "CapabilioLinkCheck/1.0", Accept: "text/html,*/*;q=0.5" } });
    } catch {
      return null;
    }
    if (res.status >= 300 && res.status < 400) {
      const next = res.headers.get("location");
      if (!next) return null;
      try {
        url = new URL(next, url).toString();
      } catch {
        return null;
      }
      continue;
    }
    const body = (await res.text().catch(() => "")).slice(0, MAX_BYTES);
    return { status: res.status, contentType: res.headers.get("content-type") ?? "", body };
  }
  return null;
}

/** A certification is shown only if its link loads as a web page that actually mentions it. */
export async function verifyCertification(c: { name: string; provider: string; url: string }, deps: { fetchImpl?: typeof fetch; resolve?: Resolver } = {}): Promise<boolean> {
  const page = await safeFetch(c.url, deps);
  if (!page || page.status < 200 || page.status >= 300 || !/html/i.test(page.contentType)) return false;
  return pageMentionsCertification(page.body, c.name, c.provider);
}

/** A learning or project link only needs to load (no claim is made about its content). */
export async function linkLoads(url: string, deps: { fetchImpl?: typeof fetch; resolve?: Resolver } = {}): Promise<boolean> {
  const page = await safeFetch(url, deps);
  return Boolean(page && page.status >= 200 && page.status < 300);
}
