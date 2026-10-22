import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getStageState } from "@/lib/stage/server";
import { createServiceClient } from "@/lib/supabase/service";
import { getStudentDirection } from "@/lib/career/direction";
import { loadDomainSet } from "@/lib/arena-challenges/domain-set";
import { getEngagedRoleKey, listEnabledRoles } from "@/lib/arena-workstations/taxonomy";
import { resolveDomainRole } from "@/lib/arena-workstations/role-resolution";
import { chooseDomainSource } from "@/lib/arena-challenges/domain-source";
import { TrackChallengesBoard } from "@/components/arena/TrackChallengesBoard";
import { DomainSetList } from "@/components/arena/domain/DomainSetList";
import { DomainCountdown } from "@/components/arena/domain/DomainCountdown";

export const metadata: Metadata = {
  title: "Domain Challenges — Arena — Capabilio AI",
  description: "Work tickets for your target career — own leaderboard, streak, and history.",
};

const SET_CAREER_HREF = "/dashboard/roadmap";

function Notice({ title, body, cta }: { title: string; body: string; cta?: { href: string; label: string }[] }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--m-rule)] bg-white px-6 py-12 text-center">
      <p className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)]">{title}</p>
      <p className="mx-auto mt-1 max-w-md font-lp-body text-[13px] text-app-muted">{body}</p>
      <div className="mt-4 flex flex-wrap justify-center gap-4">
        {(cta ?? []).map((c) => (
          <Link key={c.href} href={c.href} className="font-lp-body text-[13px] font-semibold text-app-orange hover:underline">
            {c.label}
          </Link>
        ))}
      </div>
    </div>
  );
}

export default async function DomainChallengesPage({ searchParams }: { searchParams: Promise<{ career?: string; sample?: string }> }) {
  const { user } = await requireAuthedUser();
  const params = await searchParams;
  const which = "primary"; // Domain tickets follow the main career; a Plan B must be set to unlock them
  const service = createServiceClient();
  const { stage } = await getStageState(user.id);
  const isStudent = stage === "student";
  const view = await loadDomainSet(service, user.id, which, new Date(), { skipPlanB: !isStudent });
  const setCareerHref = isStudent ? SET_CAREER_HREF : "/assessment";

  let body: React.ReactNode;
  if (params.sample === "1") {
    body = (
      <>
        <p className="mb-4 rounded-lg border border-[var(--m-rule)] bg-white px-4 py-2.5 font-lp-body text-[12.5px] text-app-muted">
          Sample track: Data Analyst. This is not tied to your target career.
        </p>
        <TrackChallengesBoard track="domain" />
      </>
    );
  } else if (view.state === "unset" || view.state === "exploring") {
    body = (
      <Notice
        title={view.state === "exploring" ? "You are still exploring" : "Set your target career"}
        body="Domain challenges are real work tickets for the role you want. Pick a career and they appear here — we don't guess one for you."
        cta={[{ href: setCareerHref, label: isStudent ? "Choose a career in Career Path" : "Choose your target role" }, { href: "?sample=1", label: "Try a sample track" }]}
      />
    );
  } else if (view.state === "no_plan_b") {
    const planBOpen = Boolean((await getStudentDirection(service, user.id))?.planBOpen);
    body = (
      <Notice
        title="Domain challenges start with your Plan B"
        body={`Until then your roadmap, SkillStudio and Stream challenges help you learn about ${view.primary} and build your base. Domain tickets begin once you choose to continue in your role or move to another in 3rd year.`}
        cta={[...(planBOpen ? [{ href: "/dashboard/roadmap", label: "Answer Plan B" }] : []), ...(isStudent ? [{ href: "/arena/challenges/stream", label: "Go to Stream challenges" }] : [])]}
      />
    );
  } else {
    // the same role resolution the workstation API uses, so the page and the API cannot disagree
    const [roles, direction, engagedRoleKey] = await Promise.all([listEnabledRoles(service), getStudentDirection(service, user.id), getEngagedRoleKey(service, user.id)]);
    const hasWorkstation = resolveDomainRole(roles, { activeRoleKey: direction?.activeRoleKey ?? null, engagedRoleKey, statedRole: view.career.name }).role !== null;
    const source = chooseDomainSource({ hasWorkstation, catalogItems: view.items.length, catalogCountdown: Boolean(view.unlockAt) });
    body = (
      <>
        <div className="mb-5 flex flex-wrap items-center gap-2 font-lp-body text-[13px]">
          <span className="text-app-muted">Your role:</span>
          <span className="rounded-full bg-app-blue-container px-3 py-1 font-semibold text-app-blue">{view.career.name}</span>
        </div>
        {source === "workstation" ? (
          <TrackChallengesBoard track="domain" />
        ) : source === "catalog" ? (
          <TrackChallengesBoard
            track="domain"
            workspace={view.unlockAt ? <DomainCountdown unlockAt={view.unlockAt} /> : <DomainSetList items={view.items} />}
          />
        ) : (
          <Notice
            title={`No challenges configured yet for ${view.career.name}`}
            body="We only show real, reviewed challenges. You can try another track while this one is being built."
            cta={[{ href: "?sample=1", label: "Browse other tracks" }, ...(isStudent ? [{ href: "/arena/challenges/stream", label: "Go to Stream challenges" }] : [])]}
          />
        )}
      </>
    );
  }

  return (
    <div>
      <Link href="/arena/challenges" className="inline-flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-[var(--m-ink)]">
        <ArrowLeft size={14} />
        Challenges
      </Link>
      <h1 className="mt-2 font-lp-display text-[26px] font-bold text-[var(--m-ink)]">Domain Challenges</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Work tickets for your target career role.</p>
      <div className="pt-6">{body}</div>
    </div>
  );
}
