import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { getCourseDetail, getSkillCatalog } from "@/lib/curriculum/admin-data";
import { PageHeader, Panel, EmptyState } from "@/components/org/ui";
import { CourseEditor } from "@/components/curriculum/CourseEditor";
import { MappingList } from "@/components/curriculum/MappingList";
import { StatusPill } from "@/components/curriculum/bits";
import type { ImportStatus } from "@/lib/curriculum/mapping-rules";

export const metadata: Metadata = { title: "Course — Capabilio AI" };

export default async function CoursePage({ params }: { params: Promise<{ importId: string; courseId: string }> }) {
  const { importId, courseId } = await params;
  const { ctx, service } = await orgPageContext("manageCurriculum");
  const detail = await getCourseDetail(service, ctx.institutionId, courseId);
  if (!detail || detail.import.id !== importId || detail.course.deleted_at) notFound();
  const catalog = await getSkillCatalog(service);
  const { course } = detail;

  return (
    <div className="flex flex-col gap-6">
      <div>
        <Link href={`/org/curriculum/${importId}?step=courses`} className="inline-flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-muted hover:text-app-charcoal"><ArrowLeft size={13} aria-hidden="true" /> Back to the curriculum</Link>
      </div>
      <PageHeader
        title={course.title}
        subtitle={`${detail.import.branch}${detail.import.regulation ? ` · ${detail.import.regulation}` : ""} · Year ${course.year}${course.semester ? ` · Semester ${course.semester}` : ""}${course.category ? ` · ${course.category}` : ""}`}
        action={<StatusPill status={detail.import.status as ImportStatus} />}
      />

      <CourseEditor key={`${course.updated_at}`} detail={detail} />

      <div id="skills" className="scroll-mt-6" />
      <Panel title="Skills this course builds">
        <p className="mb-3 font-lp-body text-[12.5px] leading-relaxed text-app-muted">
          The AI only suggests. A skill counts toward students&apos; roadmaps once you confirm it. Rejecting stores your decision so it isn&apos;t suggested again.
        </p>
        <MappingList courseId={course.id} mappings={detail.mappings} catalog={catalog} editable={detail.editable} />
      </Panel>

      <Panel title="Skills by learning outcome">
        {detail.outcomes.length === 0 ? (
          <EmptyState title="No learning outcomes yet" body="Add the course outcomes above and save. Each outcome can then be mapped to the skills it builds." />
        ) : (
          <ul className="flex flex-col gap-5">
            {detail.outcomes.map((o) => (
              <li key={o.id}>
                <p className="font-lp-body text-[13px] text-app-charcoal"><span className="font-lp-mono text-[11px] text-app-orange">{o.code}</span>{o.bloom_level && <span className="ml-2 font-lp-mono text-[10.5px] text-app-muted">{o.bloom_level}</span>}</p>
                <p className="mb-2 mt-0.5 font-lp-body text-[12.5px] leading-relaxed text-app-muted">{o.text}</p>
                <MappingList courseId={course.id} outcomeId={o.id} mappings={o.mappings} catalog={catalog} editable={detail.editable} compact />
              </li>
            ))}
          </ul>
        )}
      </Panel>

      <Panel title="Career relevance">
        <EmptyState title="Career requirements aren't configured yet" body="Once careers and the skills they need are set up, this shows how strongly this course's confirmed skills match each career — calculated from your confirmations, never typed in." />
      </Panel>
    </div>
  );
}
