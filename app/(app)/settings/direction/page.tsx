import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { formatAcademicYear } from "@/lib/career/academic-year";
import { goalLabel } from "@/lib/career/goal-copy";
import { GoalStateOptions } from "@/components/direction/GoalStateOptions";
import { YearConfirmCard } from "@/components/direction/YearConfirmCard";

export const metadata: Metadata = { title: "Career direction — Capabilio AI" };

/** Always-accessible: view and change goal state and program years, any time, no re-onboarding. */
export default async function DirectionSettingsPage() {
  const { supabase, user } = await requireAuthedUser();
  const { direction } = await getViewerSummary(supabase, user.id);

  if (!direction) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Career direction</h1>
        <p className="mt-2 font-lp-body text-[13px] text-app-muted">
          No student program is on your account yet. Add your college in{" "}
          <Link href="/dashboard/vault" className="text-app-blue hover:underline">
            Educational history
          </Link>{" "}
          first.
        </p>
      </div>
    );
  }

  const year = direction.academicYear?.year ?? null;
  return (
    <div className="mx-auto max-w-2xl">
      <Link href="/settings" className="font-lp-mono text-[11px] text-app-muted hover:text-app-charcoal">
        ← Settings
      </Link>
      <h1 className="mt-2 font-lp-display text-[26px] font-semibold text-app-charcoal">Career direction</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Currently: <strong className="text-app-charcoal">{goalLabel(direction.goalState)}</strong>. Change it whenever your plans change —
        nothing is locked in and your Portfolio evidence is never affected.
      </p>

      <section className="mt-6 rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">What are you planning after college?</h2>
        <div className="mt-3">
          <GoalStateOptions current={direction.goalState} />
        </div>
      </section>

      <section className="mt-6">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Your program years</h2>
        <p className="mt-1 mb-3 font-lp-body text-[12.5px] text-app-muted">
          {formatAcademicYear(year, direction.startYear, direction.endYear) ?? "Not set"}. Correct this if you have a backlog, gap year or repeated year.
        </p>
        <YearConfirmCard
          startYear={direction.startYear}
          endYear={direction.endYear}
          computedYear={year}
          overrideYear={direction.academicYear?.source === "override" ? year : null}
          startEditing
        />
      </section>
    </div>
  );
}
