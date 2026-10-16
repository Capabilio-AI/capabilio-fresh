import Link from "next/link";
import { ArrowRight, FileText, MessagesSquare } from "lucide-react";
import { JobForm } from "@/components/stage/JobForm";

const CARD = "rounded-2xl border border-[var(--m-rule)] bg-white p-5";
const H = "font-lp-display text-[18px] font-bold text-[var(--m-ink)]";

export function InterviewCard({ unlocked, count }: { unlocked: boolean; count: number }) {
  return (
    <section className={`${CARD} flex flex-col`} aria-labelledby="iv-h">
      <h2 id="iv-h" className={`${H} flex items-center gap-2`}><MessagesSquare size={17} aria-hidden />AI Interview</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-app-muted">
        {unlocked ? (count > 0 ? `${count} mock ${count === 1 ? "round" : "rounds"} done. Another round makes the real one feel familiar.` : "Practise a technical, behavioural or HR round and get feedback before it counts.") : "Practise technical, behavioural and HR rounds. Included in Pro and Elite."}
      </p>
      <Link href={unlocked ? "/dashboard/interview" : "/plans"} className="mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-[13px] font-bold text-[var(--m-ink)] hover:underline">
        {unlocked ? "Start a round" : "See plans"} <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  );
}

export function ResumeCard({ resume }: { resume: { skillCount: number; applied: boolean } | null }) {
  return (
    <section className={`${CARD} flex flex-col`} aria-labelledby="rs-h">
      <h2 id="rs-h" className={`${H} flex items-center gap-2`}><FileText size={17} aria-hidden />Your resume</h2>
      <p className="mt-2 text-[13.5px] leading-relaxed text-app-muted">
        {resume ? `We read ${resume.skillCount} skills from it${resume.applied ? " and added them to your profile" : ""}. Your assessment tests the ones you claim a little harder.` : "Add your resume and we pre-fill your profile and test the skills you claim."}
      </p>
      <Link href="/assessment" className="mt-auto inline-flex w-fit items-center gap-1.5 pt-4 text-[13px] font-bold text-[var(--m-ink)] hover:underline">
        {resume ? "Review in assessment" : "Add your resume"} <ArrowRight size={14} aria-hidden />
      </Link>
    </section>
  );
}

/** The graduate's way out of the path: report a job and the profile moves to the professional path. */
export function GotAJob() {
  return (
    <details className="group rounded-2xl border border-dashed border-[var(--m-off)] bg-white p-5">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 font-lp-display text-[17px] font-bold text-[var(--m-ink)] [&::-webkit-details-marker]:hidden">
        Got a job?
        <span className="text-[13px] font-bold text-[var(--m-accent-ink)] group-open:hidden">Update my profile →</span>
      </summary>
      <p className="mb-4 mt-2 text-[13.5px] text-app-muted">Congratulations. Tell us where, and your profile moves to the professional path with all your evidence.</p>
      <JobForm />
    </details>
  );
}
