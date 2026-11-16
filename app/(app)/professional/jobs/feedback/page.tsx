import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { requireStage } from "@/lib/stage/guard";
import { listApplications } from "@/lib/professional/workspace-server";
import { FeedbackLog } from "@/components/professional/jobs/FeedbackLog";
import { JobsTabs } from "@/components/professional/jobs/JobsTabs";

export const metadata: Metadata = { title: "Feedback — Capabilio AI" };

export default async function ProfessionalFeedback() {
  await requireStage(["professional"]);
  const { user } = await requireAuthedUser();
  const data = await listApplications(user.id).catch((e: Error) => {
    console.error("[professional/feedback] load failed:", e.message);
    return null;
  });
  return (
    <div className="flex flex-col gap-5">
      <JobsTabs />
      {data ? <FeedbackLog apps={data.apps} feedback={data.feedback} today={new Date().toISOString().slice(0, 10)} /> : <p role="alert" className="rounded-3xl border border-[var(--m-rule)] bg-white p-6 text-[14.5px] text-[var(--m-ink)]">Your feedback log could not load right now. Please try again in a moment.</p>}
    </div>
  );
}
