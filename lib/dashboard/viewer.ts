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
  const [{ data: profile }, { data: memberships }] = await Promise.all([
    supabase.from("profiles").select("full_name, email, avatar_url").eq("id", userId).single(),
    // A student can have several membership rows; .maybeSingle() returned
    // nothing in that case. Same best-row rule as getStudentBranchContext.
    supabase
      .from("institution_memberships")
      .select("branch, year, status, institutions ( name )")
      .eq("user_id", userId)
      .order("created_at", { ascending: false }),
  ]);
  const rows = memberships ?? [];
  const membership = rows.find((r) => r.status === "active" && r.branch) ?? rows.find((r) => r.branch) ?? rows[0] ?? null;
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
