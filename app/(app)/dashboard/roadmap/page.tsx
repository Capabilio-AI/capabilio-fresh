import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getCareerIntent } from "@/lib/careers/intent";
import { ensureRoadmap } from "@/lib/roadmap-engine/service";
import { getRoadmapVersionView } from "@/lib/roadmap-engine/read";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { MissingState } from "@/components/roadmap/v2/MissingState";
import { Header } from "@/components/roadmap/v2/Header";
import { GoalPicker } from "@/components/roadmap/v2/GoalPicker";
import { Gaps, NextAction } from "@/components/roadmap/v2/Gaps";
import { Resources, Subjects, Timeline } from "@/components/roadmap/v2/Plan";

export const metadata: Metadata = { title: "Roadmap — Capabilio AI" };
// A first roadmap may call the model for explanations; allow for it.
export const maxDuration = 60;

export default async function RoadmapPage({ searchParams }: { searchParams: Promise<{ version?: string }> }) {
  const { user } = await requireAuthedUser();
  const service = createServiceClient();
  const wanted = z.string().uuid().safeParse((await searchParams).version);
  const [outcome, ctx] = await Promise.all([ensureRoadmap(service, user.id), getCareerIntent(service, user.id)]);

  const latest = outcome.status === "READY" ? outcome.view : null;
  const old = wanted.success && latest ? await getRoadmapVersionView(service, user.id, wanted.data) : null;
  const view = old ?? latest;
  const notes = (view?.notes ?? {}) as { position?: { year: number; semester: number }; regulation?: string | null; mandatoryNote?: string; semesterEstimated?: boolean; unmatchedCapabilities?: string[] };
  const isOld = !!old && !!latest && old.versionId !== latest.versionId;

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Roadmap</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Your college curriculum, your verified skills and your target career, in one plan. It updates as any of them change.</p>
      <div className="mt-4"><DashboardSubNav /></div>
      <div className="flex flex-col gap-8 pt-6">
        {outcome.status !== "READY" ? (
          <MissingState outcome={outcome} ctx={ctx} />
        ) : !view ? null : (
          <>
            {isOld && (
              <p role="status" className="rounded-lg border border-app-border bg-app-warning-container px-4 py-2.5 font-lp-body text-[13px] text-app-charcoal">
                You&apos;re viewing version {old!.versionNo}, an earlier version. <Link href="/dashboard/roadmap" className="text-app-blue hover:underline">Go to your latest roadmap</Link>.
              </p>
            )}
            <Header view={view} position={notes.position ?? null} regulation={notes.regulation ?? null} showRefresh={!isOld} />
            <NextAction action={view.nextBestAction} />
            <Gaps gaps={view.gaps} unmatched={notes.unmatchedCapabilities ?? []} />
            <Subjects subjects={view.subjects} mandatoryNote={notes.mandatoryNote ?? ""} />
            <Resources view={view} />
            <Timeline milestones={view.milestones} />
            {!isOld && (
              <details className="rounded-xl border border-app-border bg-white p-4">
                <summary className="cursor-pointer font-lp-body text-[13.5px] font-medium text-app-charcoal">Change my career choices</summary>
                <div className="mt-4"><GoalPicker {...ctx} /></div>
              </details>
            )}
          </>
        )}
      </div>
    </div>
  );
}
