import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { orgPageContext } from "@/lib/org/page";
import { listSubjectsForAdmin } from "@/lib/roadmap/admin-data";
import { listEnabledRoles, loadRoleTaxonomy } from "@/lib/arena-workstations/taxonomy";
import { CurriculumManager } from "@/components/admin/CurriculumManager";
import { PageHeader } from "@/components/org/ui";

export const metadata: Metadata = { title: "Curriculum — Capabilio AI" };

/** Inside the organisation workspace (it used to open the student shell). Needs the Curriculum permission. */
export default async function OrgCurriculumPage() {
  const { ctx, service } = await orgPageContext("manageCurriculum");
  const roles = await listEnabledRoles(service);
  const role = roles[0];
  if (!role) notFound();
  const { areas } = await loadRoleTaxonomy(service, role.role_key);
  const subjects = await listSubjectsForAdmin(service, ctx.institutionId, role.role_key);

  return (
    <div>
      <PageHeader
        title="Curriculum"
        subtitle={`${ctx.institutionName}. Enter your subjects by branch and year, then map each to the skills it builds. Students on the job track see how their curriculum lines up with ${role.display_name} skills.`}
      />
      <CurriculumManager subjects={subjects} roleKey={role.role_key} roleName={role.display_name} areas={areas.filter((a) => a.enabled).map((a) => ({ key: a.area_key, name: a.display_name }))} />
    </div>
  );
}
