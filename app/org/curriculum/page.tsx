import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { orgPageContext } from "@/lib/org/page";
import { listImports } from "@/lib/curriculum/admin-data";
import { listEnabledRoles } from "@/lib/arena-workstations/taxonomy";
import { latestExtraction } from "@/lib/roadmap/extract/store";
import { PageHeader } from "@/components/org/ui";
import { ImportList } from "@/components/curriculum/ImportList";
import { NewCurriculum } from "@/components/curriculum/NewCurriculum";

export const metadata: Metadata = { title: "Curriculum — Capabilio AI" };

/** Inside the organisation workspace. Needs the Curriculum permission; everything is scoped to the caller's own institution. */
export default async function OrgCurriculumPage() {
  const { ctx, service } = await orgPageContext("manageCurriculum");
  const roles = await listEnabledRoles(service);
  const role = roles[0];
  if (!role) notFound();
  const [items, staged] = await Promise.all([listImports(service, ctx.institutionId), latestExtraction(service, ctx.institutionId, ctx.userId)]);
  // A finished upload already shows up as a draft in the list; the banner is only for one still running, failed, or not saved.
  const extraction = staged && (staged.status !== "ready" || !staged.result?.importId) ? staged : null;

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Curriculum"
        subtitle={`${ctx.institutionName}. Upload your syllabus, review what was read, confirm the skills each course builds, then publish. Students see their roadmap built from what you confirm — the university's curriculum stays yours; Capabilio only interprets it.`}
      />
      <NewCurriculum extraction={extraction} roleKey={role.role_key} />
      <ImportList items={items} />
    </div>
  );
}
