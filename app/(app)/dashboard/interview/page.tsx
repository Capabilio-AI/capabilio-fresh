import type { Metadata } from "next";
import Link from "next/link";
import { Lock, MessagesSquare, Sparkles } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { getStageState } from "@/lib/stage/server";
import { interviewUnlocked } from "@/lib/plans/catalog";
import { PageHead } from "@/components/dashboard/PageHead";
import { InterviewTabs } from "@/components/interview/InterviewTabs";

export const metadata: Metadata = { title: "AI Interview — Capabilio AI" };

const CARD = "mx-auto flex max-w-xl flex-col items-center gap-3 rounded-xl border border-dashed border-[var(--m-off)] bg-white px-8 py-16 text-center";

export default async function InterviewPage() {
  const { supabase, user } = await requireAuthedUser();

  const [viewer, { stage, planId }] = await Promise.all([getViewerSummary(supabase, user.id), getStageState(user.id)]);
  const unlocked = interviewUnlocked(stage, planId, viewer.direction?.launchpadOpen ?? false);

  return (
    <div>
      <PageHead title="AI Interview" intro="Practice technical, behavioral, and HR rounds before you need them for real." />

      <div className="pt-4">
        {unlocked ? (
          <InterviewTabs />
        ) : stage === "graduate" ? (
          <div className={CARD}>
            <span className="flex h-11 w-11 items-center justify-center rounded-full bg-[var(--m-accent-soft)] text-[var(--m-accent-ink)]">
              <Sparkles size={18} />
            </span>
            <h2 className="font-lp-display text-[20px] font-bold text-[var(--m-ink)]">AI Interview is part of the Accelerate plan</h2>
            <p className="max-w-md text-[14px] text-[var(--m-muted)]">Practise technical, behavioural and HR rounds with feedback. You are not charged during early access.</p>
            <Link href="/plans" className="mt-2 inline-flex items-center gap-2 rounded-full bg-[var(--m-ink)] px-5 py-2.5 text-[13.5px] font-bold text-white">
              <MessagesSquare size={15} />
              Choose a plan
            </Link>
          </div>
        ) : (
          <div className={CARD}>
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
