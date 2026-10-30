import { createHash } from "node:crypto";

/** Pure. Deterministic uuid-shaped key for a client IP, so unauthenticated routes can use the DB-backed limiter (user_id column is a uuid). */
export function ipRateLimitKey(request: Request): string {
  const ip = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "unknown";
  const h = createHash("sha256").update(`capabilio-ip:${ip}`).digest("hex");
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-4${h.slice(13, 16)}-8${h.slice(17, 20)}-${h.slice(20, 32)}`;
}
