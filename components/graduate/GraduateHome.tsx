import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import type { GraduateHomeData } from "@/lib/graduate/home";
import { BestFitRoles } from "./BestFitRoles";
import { HuntRoute } from "./HuntRoute";
import { GotAJob, InterviewCard, ResumeCard } from "./JobHuntPanels";
import { NextMovePanel } from "./NextMovePanel";
import { ProofShelf } from "./ProofShelf";
import { RecruiterView } from "./RecruiterView";

/**
 * The recently graduated dashboard. One goal, a first offer, so it leads with the single next move and keeps what the assessment says (where you
 * start) apart from what your work has proven (what a recruiter can verify).
 */
export function GraduateHome({ data, interviewUnlocked }: { data: GraduateHomeData; interviewUnlocked: boolean }) {
  const { overview, proof, roleName } = data;
  return (
    <div className="flex flex-col gap-5">
      <LiveRefresh />
      <header className="pt-1">
        <h1 className="font-lp-display text-[34px] font-bold leading-[1.05] tracking-tight text-[var(--m-ink)] [text-wrap:balance] sm:text-[46px]">
          {data.firstName ? `${data.firstName}, here is where you stand.` : "Here is where you stand."}
        </h1>
        <p className="mt-3 max-w-[64ch] font-lp-body text-[15px] leading-relaxed text-[var(--m-muted)]">
          {overview && roleName
            ? `${proof.earned} of ${proof.total} skills for ${roleName} are proven by real work. Your assessment put your starting point at ${overview.screened}%: that shows where you begin, while badges are what a recruiter can verify.`
            : "Take the career assessment and your starting point, skill gaps and best-fit roles appear here. Badges then come from the work you do."}
        </p>
      </header>
      <DashboardSubNav />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
        <NextMovePanel move={data.move} steps={data.steps} />
        <RecruiterView proof={proof} passport={data.passport} vaultCount={data.vaultCount} interviewCount={data.interviewCount} />
      </div>
      <ProofShelf proof={proof} roleName={roleName} />
      <div className="grid gap-5 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)]">
        <BestFitRoles roles={data.roles} />
        <HuntRoute steps={data.steps} applications={data.applications} />
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <InterviewCard unlocked={interviewUnlocked} count={data.interviewCount} />
        <ResumeCard resume={data.resume} />
      </div>
      <GotAJob />
    </div>
  );
}
