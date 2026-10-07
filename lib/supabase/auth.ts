import { cache } from "react";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * The (app) layout and every page under it each need the authed user — a
 * plain call would hit Supabase's auth server twice per navigation (once
 * for the layout's guard, once for the page's own data fetch). React's
 * `cache()` dedupes this to a single call per request/render pass, since
 * layout and page render within the same pass for one navigation.
 */
export const getAuthedUser = cache(async () => {
  const supabase = await createClient();
  // getClaims() verifies the JWT locally against the cached JWKS (asymmetric keys) —
  // getUser() was a network round trip to the Supabase region on every navigation.
  const { data } = await supabase.auth.getClaims();
  const user = data?.claims?.sub ? { id: data.claims.sub, email: data.claims.email ?? null } : null;
  return { supabase, user };
});

/** Same as getAuthedUser, but redirects to /login when there's no session — the common case for every protected page. */
export async function requireAuthedUser() {
  const { supabase, user } = await getAuthedUser();
  if (!user) redirect("/login");
  return { supabase, user };
}
