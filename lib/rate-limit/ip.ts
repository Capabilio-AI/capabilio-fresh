import { createHash } from "node:crypto";

/**
 * Pure. Client IP as the Vercel edge reports it: it overwrites x-real-ip / x-vercel-forwarded-for and x-forwarded-for, so a caller cannot choose them.
 * Only valid behind Vercel; on any other host these headers are client-controlled and must not gate anything.
 */
export function clientIp(request: Request): string {
  const h = request.headers;
  return (h.get("x-real-ip") ?? h.get("x-vercel-forwarded-for") ?? h.get("x-forwarded-for")?.split(",")[0])?.trim() || "unknown";
}

/** Pure. Deterministic uuid-shaped key for a client IP, so unauthenticated routes can use the DB-backed limiter (user_id column is a uuid). */
export function ipRateLimitKey(request: Request): string {
  const ip = clientIp(request);
  const h = createHash("sha256").update(`capabilio-ip:${ip}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
