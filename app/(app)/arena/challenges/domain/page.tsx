import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadDomainSet } from "@/lib/arena-challenges/domain-set";
import { listEnabledRoles, matchRoleForStatedCareer } from "@/lib/arena-workstations/taxonomy";
import { TrackChallengesBoard } from "@/components/arena/TrackChallengesBoard";
import { DomainSetList } from "@/components/arena/domain/DomainSetList";

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
  const which = "primary"; // students choose one target career; Plan B is no longer offered
  const service = createServiceClient();
  const view = await loadDomainSet(service, user.id, which);

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
        cta={[{ href: SET_CAREER_HREF, label: "Choose a career in Career Path" }, { href: "?sample=1", label: "Try a sample track" }]}
      />
    );
  } else if (view.state === "no_plan_b") {
    body = (
      <Notice
        title="No Plan B career set"
        body={`Your main career is ${view.primary}. Add a Plan B in Career Path to practise for it too.`}
        cta={[{ href: SET_CAREER_HREF, label: "Add a Plan B" }, { href: "/arena/challenges/domain", label: `Back to ${view.primary}` }]}
      />
    );
  } else {
    const roles = view.items.length === 0 ? await listEnabledRoles(service) : [];
    const hasLegacyWorkstation = matchRoleForStatedCareer(roles, view.career.name) !== null;
    body = (
      <>
        <div className="mb-5 flex flex-wrap items-center gap-2 font-lp-body text-[13px]">
          <span className="text-app-muted">Your target:</span>
          <Link href="/arena/challenges/domain" className={`rounded-full px-3 py-1 font-semibold ${view.which === "primary" ? "bg-app-blue-container text-app-blue" : "border border-[var(--m-rule)] text-app-muted"}`}>
            {view.primary}
          </Link>
          <Link href={SET_CAREER_HREF} className="ml-auto text-app-muted hover:text-[var(--m-ink)]">
            change
          </Link>
        </div>
        {view.items.length > 0 ? (
          <TrackChallengesBoard
            track="domain"
            workspace={
              <>
                {view.shortfall > 0 && (
                  <p className="mb-4 rounded-lg border border-[var(--m-rule)] bg-white px-4 py-2.5 font-lp-body text-[12.5px] text-app-muted">
                    Only {view.items.length} challenge{view.items.length === 1 ? " is" : "s are"} published for {view.career.name} so far.
                  </p>
                )}
                <DomainSetList items={view.items} />
              </>
            }
          />
        ) : hasLegacyWorkstation ? (
          <TrackChallengesBoard track="domain" />
        ) : (
          <Notice
            title={`No challenges configured yet for ${view.career.name}`}
            body="We only show real, reviewed challenges. You can try another track while this one is being built."
            cta={[{ href: "?sample=1", label: "Browse other tracks" }, { href: "/arena/challenges/stream", label: "Go to Stream challenges" }]}
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
