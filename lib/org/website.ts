/**
 * Pure. A company website as a college types it ("infosys.com", "www.infosys.com/careers", "https://infosys.com") -> a safe https/http URL, or null.
 * Anything that is not plain http(s) ("javascript:...", "data:...", "ftp://...") is rejected, so a stored value is always safe to render as a link.
 */
export function normalizeWebsite(raw: string | null | undefined): string | null {
  const v = (raw ?? "").trim();
  if (!v || v.length > 300 || /\s/.test(v)) return null;
  const withScheme = /^[a-z][a-z0-9+.-]*:/i.test(v) && !/^[a-z0-9.-]+:\d+/i.test(v) ? v : `https://${v}`;
  try {
    const url = new URL(withScheme);
    if (url.protocol !== "https:" && url.protocol !== "http:") return null;
    if (!url.hostname.includes(".") || url.username || url.password) return null;
    return url.toString().replace(/\/$/, "");
  } catch {
    return null;
  }
}
