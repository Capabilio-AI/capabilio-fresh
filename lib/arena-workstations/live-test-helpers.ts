import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Service-role client for *.live.test.ts only (Node 20 has no native WebSocket, so realtime is stubbed). */
export function liveServiceClient(): SupabaseClient<Database> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error("Live tests need NEXT_PUBLIC_SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY (.env.local).");
  return createClient<Database>(url, key, { auth: { persistSession: false }, realtime: { transport: class {} as never } });
}

/** A throwaway auth user; deleting it cascades every row the test created. */
export async function createThrowawayUser(service: SupabaseClient<Database>, label: string): Promise<string> {
  const { data, error } = await service.auth.admin.createUser({
    email: `arena-${label}-${Date.now()}@test.capabilio.invalid`,
    password: crypto.randomUUID(),
    email_confirm: true,
  });
  if (error || !data.user) throw error ?? new Error("createUser failed");
  return data.user.id;
}

export async function deleteThrowawayUser(service: SupabaseClient<Database>, userId: string): Promise<void> {
  // Challenge instances reference the user via arena_challenges.user_id (cascade),
  // but completions reference instances; delete attempts/instances explicitly first.
  await service.from("arena_attempt_completions").delete().eq("user_id", userId);
  await service.from("evidence").delete().eq("user_id", userId);
  await service.from("arena_challenge_completions").delete().eq("user_id", userId);
  await service.from("arena_domain_assignments").delete().eq("user_id", userId);
  await service.from("arena_challenges").delete().eq("user_id", userId);
  await service.auth.admin.deleteUser(userId);
}
