import Link from "next/link";
import type { Database } from "@/lib/supabase/types";
import { Panel } from "@/components/org/ui";
import { formatDateTime } from "@/components/org/ui";
import { StatusButton } from "./StatusButton";

type Imp = Database["public"]["Tables"]["curriculum_imports"]["Row"];

/** Where this curriculum came from, what was read automatically, and what the reader wasn't sure about. */
export function UploadStep({ imp, editable }: { imp: Imp; editable: boolean }) {
  const s = (imp.extraction_summary ?? {}) as { warnings?: string[]; aiFallbackCourses?: number; courses?: number; outcomes?: number; units?: number; experiments?: number; programOutcomes?: number };
  const fromPdf = Boolean(imp.source_file_name);
  const start = imp.status === "DRAFT" || imp.status === "EXTRACTED";
  return (
    <div className="flex flex-col gap-4">
      <Panel title="Source">
        {fromPdf ? (
          <>
            <p className="font-lp-body text-[13px] text-app-charcoal">Read from <span className="font-semibold">{imp.source_file_name}</span> on {formatDateTime(imp.created_at)}.</p>
            <p className="mt-2 font-lp-body text-[12.5px] leading-relaxed text-app-muted">
              Found {s.courses ?? "—"} courses, {s.outcomes ?? "—"} learning outcomes, {s.units ?? "—"} units, {s.experiments ?? "—"} lab experiments and {s.programOutcomes ?? 0} programme outcomes.
              Each field was copied from the syllabus; anything the syllabus didn&apos;t state is left empty rather than guessed.
              {imp.extraction_model && <span className="font-lp-mono text-[11px]"> {imp.extraction_model} · {imp.extraction_version}</span>}
            </p>
            {(s.aiFallbackCourses ?? 0) > 0 && <p className="mt-2 font-lp-body text-[12.5px] text-app-warning">{s.aiFallbackCourses} course(s) had an unfamiliar layout and were read with AI assistance — check them in the Courses step.</p>}
            {(s.warnings ?? []).map((w) => <p key={w} className="mt-2 font-lp-body text-[12.5px] text-app-warning">{w}</p>)}
          </>
        ) : (
          <p className="font-lp-body text-[13px] text-app-muted">This curriculum was started by hand — there&apos;s no source file. Add courses in the Courses step.</p>
        )}
        <p className="mt-3 font-lp-body text-[12.5px] text-app-muted">Nothing here is visible to students until you publish it. Re-uploading a new regulation creates a separate curriculum; publishing it replaces the older version of the same regulation (the old one is archived, never deleted).</p>
        <p className="mt-3"><Link href="/org/curriculum" className="font-lp-body text-[12.5px] text-app-blue hover:underline">Upload another syllabus or start a new curriculum</Link></p>
      </Panel>
      {editable && start && (
        <Panel title="Ready to review?">
          <p className="mb-3 font-lp-body text-[12.5px] text-app-muted">Starting the review marks this curriculum as under review. You can edit everything until you publish.</p>
          <StatusButton importId={imp.id} to="UNDER_REVIEW" label="Start review" then={`/org/curriculum/${imp.id}?step=structure`} />
        </Panel>
      )}
    </div>
  );
}
