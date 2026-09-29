import { notFound, redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "./context";
import { can, type Permission } from "./roles";

/** Per-page guard: an ACTIVE org membership whose kind holds `permission`; anyone else gets a plain 404. */
export async function orgPageContext(permission?: Permission) {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx) redirect("/login?path=organisation");
  if (permission && !can(ctx, permission)) notFound();
  return { ctx, supabase, service: createServiceClient() };
}
