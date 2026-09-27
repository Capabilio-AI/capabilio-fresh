import type { Metadata } from "next";
import { Lock, MessagesSquare } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { JOURNEY_STAGES, currentStageIndex, isStageUnlocked, UNLOCK_STAGE_KEY } from "@/lib/journey/stage";
import { InterviewTabs } from "@/components/interview/InterviewTabs";

export const metadata: Metadata = { title: "AI Interview — Capabilio AI" };

export default async function InterviewPage() {
  const { supabase, user } = await requireAuthedUser();

  const viewer = await getViewerSummary(supabase, user.id);
  const unlocked = isStageUnlocked(viewer.year, UNLOCK_STAGE_KEY);
  const stageLabel = JOURNEY_STAGES[currentStageIndex(viewer.year)].label;

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">AI Interview</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Practice technical, behavioral, and HR rounds before you need them for real.
      </p>

      <div className="pt-6">
        {unlocked ? (
          <InterviewTabs />
        ) : (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-dashed border-app-border bg-white px-8 py-16 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-app-attention-container text-app-attention">
              <Lock size={18} />
            </span>
            <h2 className="font-lp-display text-[17px] font-semibold text-app-charcoal">
              Complete your 3-2 development stage to unlock AI-powered interview preparation.
            </h2>
            <p className="font-lp-body text-[13px] text-app-muted">
              You&apos;re currently at the <span className="font-medium text-app-charcoal">{stageLabel}</span> stage.
            </p>
            <button
              type="button"
              disabled
              className="mt-2 flex cursor-not-allowed items-center gap-2 rounded-lg bg-app-charcoal/40 px-4 py-2.5 font-lp-body text-[13px] font-semibold text-white"
            >
              <MessagesSquare size={15} />
              Unlocks at Experience stage
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
