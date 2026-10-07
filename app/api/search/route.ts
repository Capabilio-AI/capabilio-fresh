import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { requireUser } from "@/lib/api/require-user";
import { checkRateLimit, rateLimitedResponse } from "@/lib/rate-limit/check";
import { searchPulse } from "@/lib/pulse/search";

/** Global search: people and colleges. Debounced by the client; rate limited here. */
export async function GET(request: Request) {
  const auth = await requireUser(await createClient());
  if ("error" in auth) return auth.error;
  const limit = await checkRateLimit(auth.userId, { bucket: "global_search", maxRequests: 90, windowSeconds: 60 });
  if (!limit.allowed) return rateLimitedResponse(limit.remaining);
  const url = new URL(request.url);
  const full = url.searchParams.get("full") === "1";
  return NextResponse.json(await searchPulse(createServiceClient(), auth.userId, url.searchParams.get("q") ?? "", full ? { people: 30, colleges: 15 } : undefined));
}
