import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgAdmin } from "@/lib/roadmap/admin-gate";
import { listSubjectsForAdmin } from "@/lib/roadmap/admin-data";
import { listEnabledRoles, loadRoleTaxonomy } from "@/lib/arena-workstations/taxonomy";
import { CurriculumManager } from "@/components/admin/CurriculumManager";

export const metadata: Metadata = { title: "Curriculum — Capabilio AI" };

/** Organisation admins only. Everyone else gets a plain 404 — the page does not confirm it exists. */
export default async function AdminCurriculumPage() {
  const { supabase, user } = await requireAuthedUser();
  const admin = await getOrgAdmin(supabase, user.id);
  if (!admin) notFound();

  const service = createServiceClient();
  const roles = await listEnabledRoles(service);
  const role = roles[0];
  if (!role) notFound();
  const { areas } = await loadRoleTaxonomy(service, role.role_key);
  const subjects = await listSubjectsForAdmin(service, admin.institutionId, role.role_key);

  return (
    <div className="mx-auto max-w-4xl">
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Curriculum</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        {admin.institutionName}. Enter your subjects by branch and year, then map each to the skills it builds. Students on the job track see how their
        curriculum lines up with {role.display_name} skills.
      </p>
      <CurriculumManager
        subjects={subjects}
        roleKey={role.role_key}
        roleName={role.display_name}
        areas={areas.filter((a) => a.enabled).map((a) => ({ key: a.area_key, name: a.display_name }))}
      />
    </div>
  );
}
