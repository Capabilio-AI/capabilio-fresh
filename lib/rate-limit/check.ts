import { NextResponse } from "next/server";
import { createServiceClient } from "@/lib/supabase/service";

export interface RateLimitConfig {
  bucket: string;
  maxRequests: number;
  windowSeconds: number;
}

/**
 * Fixed-window, DB-backed rate limit — correct across serverless instances,
 * unlike an in-memory counter (see docs/audit/2026-09-27-full-audit.md §5,
 * "no rate limiting anywhere"). Uses the service-role client because the
 * underlying increment_rate_limit() RPC takes an arbitrary user_id and is
 * locked down to service-role only (a regular authenticated client could
 * otherwise grief another user's bucket).
 */
export async function checkRateLimit(
  userId: string,
  config: RateLimitConfig
): Promise<{ allowed: boolean; remaining: number }> {
  const windowStart = new Date(
    Math.floor(Date.now() / (config.windowSeconds * 1000)) * config.windowSeconds * 1000
  ).toISOString();

  const supabase = createServiceClient();
  const { data: count, error } = await supabase.rpc("increment_rate_limit", {
    p_user_id: userId,
    p_bucket: config.bucket,
    p_window_start: windowStart,
  });

  // Fail open: if the rate-limit check itself errors, don't block the
  // underlying feature over an infrastructure hiccup — log and allow.
  if (error) {
    console.error(`[rate-limit] check failed for bucket "${config.bucket}":`, error.message);
    return { allowed: true, remaining: config.maxRequests };
  }

  const hitCount = count ?? 0;
  return { allowed: hitCount <= config.maxRequests, remaining: Math.max(0, config.maxRequests - hitCount) };
}

/** Standard 429 response for a route that's over its limit. */
export function rateLimitedResponse(remaining: number) {
  return NextResponse.json(
    { error: "Too many requests — please slow down and try again shortly." },
    { status: 429, headers: { "X-RateLimit-Remaining": String(remaining) } }
  );
}
