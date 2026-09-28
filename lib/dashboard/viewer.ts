import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";

/** Light profile summary for the app shell (topbar, sidebar) — no assessment requirement, unlike getDashboardData. */
export interface ViewerSummary {
  fullName: string | null;
  email: string;
  avatarUrl: string | null;
  collegeName: string | null;
  branch: string | null;
  year: string | null;
}

export async function getViewerSummary(
  supabase: SupabaseClient<Database>,
  userId: string
): Promise<ViewerSummary> {
  const [{ data: profile }, { data: membership }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, avatar_url").eq("id", userId).single(),
    supabase
      .from("institution_memberships")
      .select("branch, year, institutions ( name )")
      .eq("user_id", userId)
      .maybeSingle(),
  ]);
  const institution = membership?.institutions as { name: string } | null;
  return {
    fullName: profile?.full_name ?? null,
    email: profile?.email ?? "",
    avatarUrl: profile?.avatar_url ?? null,
    collegeName: institution?.name ?? null,
    branch: membership?.branch ?? null,
    year: membership?.year ?? null,
  };
}

export function initialsOf(name: string | null, email: string): string {
  if (name) {
    const parts = name.trim().split(/\s+/).filter(Boolean);
    if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
    if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}
