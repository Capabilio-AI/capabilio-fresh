import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { orgPageContext } from "@/lib/org/page";
import { listImports } from "@/lib/curriculum/admin-data";
import { listEnabledRoles } from "@/lib/arena-workstations/taxonomy";
import { latestExtraction } from "@/lib/roadmap/extract/store";
import Link from "next/link";
import { ChevronRight } from "lucide-react";
import { PageHeader } from "@/components/org/ui";
import { Fact, GroupTitle } from "@/components/org/widgets";
import { BranchBoards } from "@/components/curriculum/BranchBoards";
import { buildBoards, loadStudentRows } from "@/lib/curriculum/cohorts";
import { NewCurriculum } from "@/components/curriculum/NewCurriculum";

export const metadata: Metadata = { title: "Curriculum — Capabilio AI" };

/** Inside the organisation workspace. Needs the Curriculum permission; everything is scoped to the caller's own institution. */
export default async function OrgCurriculumPage() {
  const { ctx, service } = await orgPageContext("manageCurriculum");
  const roles = await listEnabledRoles(service);
  const role = roles[0];
  if (!role) notFound();
  const [items, students, staged] = await Promise.all([listImports(service, ctx.institutionId), loadStudentRows(service, ctx.institutionId), latestExtraction(service, ctx.institutionId, ctx.userId)]);
  const boards = buildBoards(items, students);
  // A finished upload already shows up as a draft in the list; the banner is only for one still running, failed, or not saved.
  const extraction = staged && (staged.status !== "ready" || !staged.result?.importId) ? staged : null;

  const published = items.filter((i) => i.status === "PUBLISHED").length;
  const inProgress = items.filter((i) => i.status !== "PUBLISHED" && i.status !== "ARCHIVED").length;
  const waiting = boards.reduce((n, b) => n + (b.publishedRegulations.length === 0 ? b.students : b.withoutPublished), 0);
  const toReview = items.reduce((n, i) => n + i.summary.mappingsNeedingReview, 0);

  // what to do next, most useful first
  const next: { key: string; text: string; sub: string; href: string }[] = [];
  for (const b of boards) {
    if (b.imports.length === 0 && b.students > 0) next.push({ key: `none-${b.key}`, text: `No curriculum for ${b.branch}`, sub: `${b.students} students have none. Upload the syllabus under this exact branch name.`, href: "#new-curriculum" });
    else if (b.students > 0 && b.publishedRegulations.length === 0) {
      const draft = b.imports.find((i) => i.status !== "ARCHIVED");
      next.push({ key: `pub-${b.key}`, text: `Publish a curriculum for ${b.branch}`, sub: `${b.students} students are waiting on it.`, href: draft ? `/org/curriculum/${draft.id}` : "#new-curriculum" });
    }
  }
  for (const i of items) {
    if (i.status !== "PUBLISHED" && i.status !== "ARCHIVED" && i.summary.mappingsNeedingReview > 0) {
      next.push({ key: `rev-${i.id}`, text: `Review ${i.summary.mappingsNeedingReview} suggested skills in ${i.branch}${i.regulation ? ` ${i.regulation}` : ""}`, sub: "Confirm or reject what the AI read from the syllabus.", href: `/org/curriculum/${i.id}` });
    }
  }

  return (
    <div className="flex flex-col gap-8">
      <PageHeader
        title="Curriculum"
        subtitle={`${ctx.institutionName}. Keep one curriculum per branch and regulation. Upload the syllabus, review what was read, confirm the skills each course builds, publish, then link your students to their regulation. Students see a roadmap built from what you confirm.`}
      />
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Fact label="Published" value={published} hint="Live in student roadmaps" tone="text-app-success" />
        <Fact label="In progress" value={inProgress} hint="Drafts and reviews" />
        <Fact label="Skills to review" value={toReview} hint="Waiting for a person" tone={toReview ? "text-app-warning" : "text-app-charcoal"} />
        <Fact label="Students waiting" value={waiting} hint="No published curriculum yet" tone={waiting ? "text-app-warning" : "text-app-charcoal"} />
      </div>

      {next.length > 0 && (
        <section aria-label="Do next">
          <GroupTitle count={next.length}>Do next</GroupTitle>
          <ul className="o-card ws-rows overflow-hidden">
            {next.slice(0, 4).map((n) => (
              <li key={n.key}>
                <Link href={n.href} className="flex items-center gap-3 px-4 py-3.5 transition-colors hover:bg-white/[0.035]">
                  <span className="h-2.5 w-2.5 shrink-0 rounded-full bg-app-warning" aria-hidden="true" />
                  <span className="min-w-0 flex-1">
                    <span className="block text-[14px] font-semibold text-app-charcoal">{n.text}</span>
                    <span className="block text-[12.5px] text-app-muted">{n.sub}</span>
                  </span>
                  <ChevronRight size={16} className="shrink-0 text-app-muted" aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </section>
      )}

      <div id="new-curriculum">
        <NewCurriculum extraction={extraction} roleKey={role.role_key} />
      </div>
      <BranchBoards boards={boards} />
    </div>
  );
}
