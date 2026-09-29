import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import type { OrgContext } from "./context";
import { untyped, type ProjectRow } from "./db";

/**
 * A project the caller may manage: same institution, and — for staff (faculty/hod) — one they created.
 * Admins may manage any project of their institution. Returns null (=> 404/403) otherwise.
 */
export async function loadManagedProject(service: SupabaseClient<Database>, ctx: OrgContext, projectId: string): Promise<ProjectRow | null> {
  const { data } = await untyped(service).from("class_projects").select("*").eq("id", projectId).eq("institution_id", ctx.institutionId).maybeSingle();
  const project = data as ProjectRow | null;
  if (!project) return null;
  if (ctx.kind === "admin") return project;
  if (project.created_by_membership_id === ctx.membershipId) return project;
  return null;
}
