import type { Metadata } from "next";
import Link from "next/link";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getViewerSummary } from "@/lib/dashboard/viewer";
import { formatAcademicYear } from "@/lib/career/academic-year";
import { goalLabel } from "@/lib/career/goal-copy";
import { GoalStateOptions } from "@/components/direction/GoalStateOptions";

export const metadata: Metadata = { title: "Career direction — Capabilio AI" };

/** Always-accessible: change goal state any time. Stream and program years are set by your college and shown read-only. */
export default async function DirectionSettingsPage() {
  const { supabase, user } = await requireAuthedUser();
  const { direction } = await getViewerSummary(supabase, user.id);

  if (!direction) {
    return (
      <div className="mx-auto max-w-2xl">
        <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Career direction</h1>
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

      <section className="mt-6 rounded-xl border border-app-border bg-white p-5">
        <h2 className="font-lp-display text-[15px] font-semibold text-app-charcoal">Your stream and years</h2>
        <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">These are set by your college and stay the same through your degree. Your semester updates by itself when your college publishes its academic calendar.</p>
        <dl className="mt-4 grid grid-cols-1 gap-4 font-lp-body text-[13px] sm:grid-cols-3">
          <div><dt className="text-app-muted">Stream</dt><dd className="mt-0.5 font-semibold text-app-charcoal">{direction.branch ?? "Not set"}</dd></div>
          <div><dt className="text-app-muted">Program years</dt><dd className="mt-0.5 font-semibold text-app-charcoal">{direction.startYear && direction.endYear ? `${direction.startYear}–${direction.endYear}` : "Not set"}</dd></div>
          <div><dt className="text-app-muted">Now</dt><dd className="mt-0.5 font-semibold text-app-charcoal">{formatAcademicYear(year, direction.startYear, direction.endYear) ?? "Not set"}{year ? `, semester ${direction.semester}` : ""}</dd></div>
        </dl>
      </section>
    </div>
  );
}
