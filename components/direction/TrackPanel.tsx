import Link from "next/link";
import { Lightbulb } from "lucide-react";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/lib/supabase/types";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentDirection, shouldShowHigherStudiesCheckin } from "@/lib/career/direction";
import { getJobTrackSignals } from "@/lib/career/track-signals";
import { getEngagedRoleKey, listEnabledRoles, pickActiveRole } from "@/lib/arena-workstations/taxonomy";
import { getStatedCareerInterest } from "@/lib/career/interest-statement";
import { JobTrackCard } from "./JobTrackCard";
import { HigherStudiesCheckin } from "./HigherStudiesCheckin";

/** The path-specific dashboard experience, decided from the live goal state (unset / not_sure behave as Job). */
export async function TrackPanel({ supabase, userId }: { supabase: SupabaseClient<Database>; userId: string }) {
  const direction = await getStudentDirection(supabase, userId);
  if (!direction) return null;
  const service = createServiceClient();

  if (direction.track === "higher_studies") {
    if (!shouldShowHigherStudiesCheckin(direction)) return null;
    const roles = await listEnabledRoles(service);
    const [engagedRoleKey, statedRole] = await Promise.all([getEngagedRoleKey(service, userId), getStatedCareerInterest(service, userId)]);
    const current = pickActiveRole(roles, {
      activeRoleKey: direction.activeRoleKey,
      engagedRoleKey,
      statedRole,
    });
    const otherRoles = roles.filter((r) => r.role_key !== current?.role_key);
    return <HigherStudiesCheckin otherRoles={otherRoles.map((r) => ({ roleKey: r.role_key, label: r.display_name }))} />;
  }

  if (direction.track === "entrepreneur") {
    return (
      <div className="rounded-xl border border-app-border bg-white p-4">
        <p className="flex items-center gap-2 font-lp-body text-[13.5px] font-semibold text-app-charcoal">
          <Lightbulb size={15} className="text-app-orange" /> Entrepreneurship resources
        </p>
        <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">A short, curated list of incubators and programs to look into.</p>
        <Link href="/entrepreneur" className="mt-3 inline-block rounded-lg border border-app-border px-3.5 py-1.5 font-lp-body text-[12.5px] font-medium text-app-charcoal">
          Open resources
        </Link>
      </div>
    );
  }

  // Job track (also unset / "not sure"): only once it applies — final-years window, or an explicit Job choice.
  if (!direction.inDirectionWindow && direction.goalState !== "job") return null;
  const signals = await getJobTrackSignals(service, userId, direction);
  if (signals.newVerifiedCompletions === 0 && !direction.inDirectionWindow) return null;
  return (
    <JobTrackCard
      newVerifiedCompletions={signals.newVerifiedCompletions}
      completedInterviewSessions={signals.completedInterviewSessions}
      interviewAvailable={direction.inDirectionWindow}
    />
  );
}
