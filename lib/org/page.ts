import { notFound, redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "./context";
import { can, type Permission } from "./roles";

/**
 * Per-page guard: an ACTIVE org membership whose kind holds `permission`; anyone else gets a plain 404. A student session is sent to the student
 * dashboard: the layout does the same, but it does not re-run on client-side navigation, so after an account switch in another tab a page could
 * otherwise render student data inside the organisation shell.
 */
export async function orgPageContext(permission?: Permission) {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx) redirect("/login?path=organisation");
  if (ctx.kind === "student") redirect("/dashboard");
  if (permission && !can(ctx, permission)) notFound();
  return { ctx, supabase, service: createServiceClient() };
}
