import { createClient as createSupabaseClient } from "@supabase/supabase-js";
import type { WebSocketLikeConstructor } from "@supabase/realtime-js";
import WebSocket from "ws";
import { SUPABASE_URL } from "./env";
import type { Database } from "./types";

// Server-only: bypasses RLS. Never import this file from a "use client"
// component or a Route Handler that echoes request bodies back — it must
// only back trusted server logic (CapabilityService, GuidePathService, ...)
// that writes computed data the student can read but not set themselves.
export function createServiceClient() {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error("Missing required environment variable: SUPABASE_SERVICE_ROLE_KEY");
  }

  return createSupabaseClient<Database>(SUPABASE_URL, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
    // supabase-js always constructs a Realtime client, which otherwise
    // throws on Node < 22 (no global WebSocket) even though this client
    // never opens a realtime channel. `ws` is the SDK's own documented
    // workaround for pre-22 runtimes.
    realtime: { transport: WebSocket as unknown as WebSocketLikeConstructor },
  });
}
