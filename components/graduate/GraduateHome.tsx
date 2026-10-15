import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";
import type { GraduateHomeData } from "@/lib/graduate/home";
import { JobHuntHero } from "./JobHuntHero";
import { GotAJob, InterviewCard, LaunchpadStrip, ResumeCard, SkillsToClose } from "./JobHuntPanels";

/** The recently graduated dashboard: one job hunt, from knowing your level to applying. Not the student's programme view. */
export function GraduateHome({ data, planId, interviewUnlocked }: { data: GraduateHomeData; planId: string | null; interviewUnlocked: boolean }) {
  return (
    <div className="flex flex-col gap-5">
      <LiveRefresh />
      <JobHuntHero firstName={data.firstName} overview={data.overview} steps={data.steps} planId={planId} />
      <DashboardSubNav />
      <LaunchpadStrip items={data.opportunities} />
      <div className="grid gap-5 lg:grid-cols-[1.4fr_1fr]">
        {data.overview ? <SkillsToClose skills={data.overview.lagging} roleName={data.overview.roleName} /> : <ResumeCard resume={data.resume} />}
        <div className="grid gap-5">
          <InterviewCard unlocked={interviewUnlocked} count={data.interviewCount} />
          {data.overview && <ResumeCard resume={data.resume} />}
        </div>
      </div>
      <GotAJob />
    </div>
  );
}
