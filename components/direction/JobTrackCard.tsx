"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { Briefcase, MessagesSquare } from "lucide-react";

interface Props {
  newVerifiedCompletions: number;
  completedInterviewSessions: number;
  interviewAvailable: boolean;
}

/** Job-track pushes. Everything shown is a real count from the database; nothing appears without a real event. */
export function JobTrackCard({ newVerifiedCompletions, completedInterviewSessions, interviewAvailable }: Props) {
  const router = useRouter();

  async function reviewPortfolio() {
    await fetch("/api/direction/dismiss", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ prompt: "portfolio" }),
    });
    router.push("/dashboard/portfolio");
  }

  return (
    <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
      {newVerifiedCompletions > 0 && (
        <div className="rounded-xl border border-app-border bg-white p-4">
          <p className="flex items-center gap-2 font-lp-body text-[13.5px] font-semibold text-app-charcoal">
            <Briefcase size={15} className="text-app-orange" /> Update your Portfolio
          </p>
          <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
            You&apos;ve completed {newVerifiedCompletions} verified Arena {newVerifiedCompletions === 1 ? "task" : "tasks"} since you last reviewed your Portfolio.
          </p>
          <button type="button" onClick={reviewPortfolio} className="mt-3 rounded-lg bg-app-charcoal px-3.5 py-1.5 font-lp-body text-[12.5px] font-semibold text-white">
            Review Portfolio
          </button>
        </div>
      )}
      {interviewAvailable && (
        <div className="rounded-xl border border-app-border bg-white p-4">
          <p className="flex items-center gap-2 font-lp-body text-[13.5px] font-semibold text-app-charcoal">
            <MessagesSquare size={15} className="text-app-orange" /> Practice an interview
          </p>
          <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
            {completedInterviewSessions === 0
              ? "You haven't completed a practice interview yet."
              : `You've completed ${completedInterviewSessions} practice ${completedInterviewSessions === 1 ? "interview" : "interviews"}.`}
          </p>
          <Link href="/interview" className="mt-3 inline-block rounded-lg border border-app-border px-3.5 py-1.5 font-lp-body text-[12.5px] font-medium text-app-charcoal">
            Open AI Interview
          </Link>
        </div>
      )}
    </div>
  );
}
