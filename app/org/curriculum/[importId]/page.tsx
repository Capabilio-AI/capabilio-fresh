import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { orgPageContext } from "@/lib/org/page";
import { getImportOverview } from "@/lib/curriculum/admin-data";
import { stepFrom, type StepKey } from "@/lib/curriculum/steps";
import type { ImportStatus } from "@/lib/curriculum/mapping-rules";
import { PageHeader } from "@/components/org/ui";
import { SummaryCard, StatusPill } from "@/components/curriculum/bits";
import { WizardNav } from "@/components/curriculum/WizardNav";
import { UploadStep } from "@/components/curriculum/UploadStep";
import { StructureStep } from "@/components/curriculum/StructureStep";
import { CoursesStep } from "@/components/curriculum/CoursesStep";
import { OutcomesStep } from "@/components/curriculum/OutcomesStep";
import { MappingsStep } from "@/components/curriculum/MappingsStep";
import { RelevanceStep } from "@/components/curriculum/RelevanceStep";
import { loadImportRelevance } from "@/lib/careers/data";
import { ConfirmStep } from "@/components/curriculum/ConfirmStep";
import { PublishStep } from "@/components/curriculum/PublishStep";

export const metadata: Metadata = { title: "Curriculum review — Capabilio AI" };

export default async function CurriculumWizardPage({ params, searchParams }: { params: Promise<{ importId: string }>; searchParams: Promise<{ step?: string | string[] }> }) {
  const [{ importId }, { step: rawStep }] = await Promise.all([params, searchParams]);
  const { ctx, service } = await orgPageContext("manageCurriculum");
  const overview = await getImportOverview(service, ctx.institutionId, importId);
  if (!overview) notFound();

  const step: StepKey = stepFrom(rawStep);
  const { import: imp, summary, courses, removed } = overview;
  const status = imp.status as ImportStatus;
  const editable = status !== "PUBLISHED" && status !== "ARCHIVED";
  const withoutOutcomes = courses.filter((c) => c.outcomes === 0).length;
  const badges: Partial<Record<StepKey, string>> = {
    courses: String(courses.length),
    outcomes: withoutOutcomes ? `${withoutOutcomes} missing` : undefined,
    mappings: summary.mappingsNeedingReview ? `${summary.mappingsNeedingReview} to review` : undefined,
  };

  return (
    <div className="flex flex-col gap-6">
      <div><Link href="/org/curriculum" className="inline-flex items-center gap-1.5 font-lp-body text-[12.5px] text-app-muted hover:text-app-charcoal"><ArrowLeft size={13} aria-hidden="true" /> All curricula</Link></div>
      <PageHeader title={`${imp.branch}${imp.regulation ? ` · ${imp.regulation}` : ""}`} subtitle="Review what was read from the syllabus, confirm the skills each course builds, then publish. Nothing reaches students until you do." action={<StatusPill status={status} />} />
      <SummaryCard summary={summary} />
      <WizardNav importId={importId} current={step} badges={badges} />

      <div>
        {step === "upload" && <UploadStep imp={imp} editable={editable} />}
        {step === "structure" && <StructureStep importId={importId} branch={imp.branch} program={imp.program} regulation={imp.regulation} editable={editable} courses={courses} />}
        {step === "courses" && <CoursesStep importId={importId} courses={courses} removed={removed} editable={editable} />}
        {step === "outcomes" && <OutcomesStep importId={importId} courses={courses} />}
        {step === "mappings" && <MappingsStep importId={importId} courses={courses} editable={editable} />}
        {step === "relevance" && <RelevanceStep importId={importId} data={await loadImportRelevance(service, courses.map((c) => ({ id: c.id, title: c.title, year: c.year })))} />}
        {step === "confirm" && <ConfirmStep importId={importId} summary={summary} coursesWithoutOutcomes={withoutOutcomes} />}
        {step === "publish" && <PublishStep importId={importId} status={status} branch={imp.branch} regulation={imp.regulation} versionNo={overview.versionNo} />}
      </div>
    </div>
  );
}
