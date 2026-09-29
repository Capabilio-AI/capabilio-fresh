import { NextResponse } from "next/server";
import type { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import type { Database } from "@/lib/supabase/types";
import { getOrgContext, type OrgContext } from "@/lib/org/context";
import { can, type Permission } from "@/lib/org/roles";

// Coded errors raised by the class_* SQL functions -> HTTP.
const DB_ERRORS: Record<string, [number, string]> = {
  forbidden: [403, "You don't have permission to do that."],
  not_a_student_of_institution: [403, "Only active students of this institution can do that."],
  department_not_in_scope: [403, "This project isn't open to your department."],
  not_a_member: [403, "You aren't a member of that group."],
  project_closed: [409, "This project is closed."],
  already_in_group: [409, "You're already in a group for this project."],
  group_full: [409, "That group is full."],
  group_not_forming: [409, "That group is no longer forming."],
  group_locked: [409, "This group has already submitted."],
  group_not_ready: [409, "The group needs all its members before it can submit."],
  group_not_submitted: [409, "Nothing has been submitted for this group yet."],
  physical_submission_only: [409, "This project takes physical submissions; staff mark them received."],
  in_app_submission_only: [409, "This project takes in-app submissions."],
  invalid_grade: [400, "Enter a grade of 1-10 characters."],
  invalid_contribution_notes: [400, "Contribution notes may only name members of the group."],
  group_not_found: [404, "Group not found."],
  project_not_found: [404, "Project not found."],
};

export function dbErrorResponse(message: string | undefined): NextResponse {
  const code = Object.keys(DB_ERRORS).find((c) => message?.includes(c));
  if (!code) return NextResponse.json({ error: "Something went wrong. Please try again." }, { status: 500 });
  const [status, text] = DB_ERRORS[code];
  return NextResponse.json({ error: text }, { status });
}

export interface RouteEnv {
  ctx: OrgContext;
  supabase: SupabaseClient<Database>;
  service: SupabaseClient<Database>;
}

/**
 * Shared shell for org/classroom write routes: strict-parse the body, require a signed-in user with an
 * ACTIVE membership whose kind holds `permission`, then run the handler. The institution and role come
 * from the membership, never the request. Handlers return data (200) or a NextResponse.
 */
export async function orgRoute<S extends z.ZodTypeAny>(
  request: Request,
  schema: S,
  permission: Permission,
  handler: (env: RouteEnv, body: z.infer<S>) => Promise<NextResponse | Record<string, unknown>>
): Promise<NextResponse> {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: parsed.error.issues[0]?.message ?? "Invalid request." }, { status: 400 });

  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await getOrgContext(supabase, data.user.id);
  if (!ctx || !can(ctx, permission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });

  try {
    const out = await handler({ ctx, supabase, service: createServiceClient() }, parsed.data);
    return out instanceof NextResponse ? out : NextResponse.json({ ok: true, ...out });
  } catch (e) {
    return dbErrorResponse(e instanceof Error ? e.message : (e as { message?: string })?.message);
  }
}

/** For non-JSON handlers (multipart uploads, downloads): the same auth + permission gate as orgRoute. */
export async function authorizeOrg(permission: Permission): Promise<RouteEnv | NextResponse> {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user) return NextResponse.json({ error: "Not authenticated" }, { status: 401 });
  const ctx = await getOrgContext(supabase, data.user.id);
  if (!ctx || !can(ctx, permission)) return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  return { ctx, supabase, service: createServiceClient() };
}
