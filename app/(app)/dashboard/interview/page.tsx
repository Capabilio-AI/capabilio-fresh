import type { Metadata } from "next";
import { Lock, MessagesSquare } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { PageHead } from "@/components/dashboard/PageHead";
import { InterviewTabs } from "@/components/interview/InterviewTabs";

export const metadata: Metadata = { title: "AI Interview — Capabilio AI" };

export default async function InterviewPage() {
  const { supabase, user } = await requireAuthedUser();

  const viewer = await getViewerSummary(supabase, user.id);
  const unlocked = viewer.direction?.launchpadOpen ?? false;

  return (
    <div>
      <PageHead title="AI Interview" intro="Practice technical, behavioral, and HR rounds before you need them for real." />

      <div className="pt-4">
        {unlocked ? (
          <InterviewTabs />
        ) : (
          <div className="mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--m-off)] bg-white px-8 py-16 text-center">
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-app-attention-container text-app-attention">
              <Lock size={18} />
            </span>
            <h2 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">
              AI interview practice opens when you enter your final year (4-1).
            </h2>
            <button
              type="button"
              disabled
              className="mt-2 flex cursor-not-allowed items-center gap-2 rounded-lg bg-[var(--m-ink)]/40 px-4 py-2.5 font-lp-body text-[13px] font-semibold text-white"
            >
              <MessagesSquare size={15} />
              Opens in your final two years
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
