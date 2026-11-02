import type { Metadata } from "next";
import { headers } from "next/headers";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getPortfolioData } from "@/lib/portfolio/data";
import { PageHead } from "@/components/dashboard/PageHead";
import { PortfolioBody } from "@/components/portfolio/PortfolioBody";
import { ShareLinkCard } from "@/components/portfolio/ShareLinkCard";
import { RecruiterShareCard } from "@/components/portfolio/RecruiterShareCard";
import { createServiceClient } from "@/lib/supabase/service";
import { listShares } from "@/lib/recruiter/shares";
import { getPortfolioShareUrl } from "./actions";

export const metadata: Metadata = { title: "Portfolio — Capabilio AI" };

/**
 * Evidence-first portfolio, following capabilio-web's order (hero → recruiter
 * snapshot → capabilities & evidence → Arena → GitHub → projects/certificates).
 * Per-skill capability lines stay evidence-only (a count of real work, never
 * a bare score) — the one deliberate exception is the aggregate Arena Rating
 * badge, which mirrors capabilio-web's own ELO display.
 */
export default async function PortfolioPage() {
  const { supabase, user } = await requireAuthedUser();

  const [data, { data: shareRow }] = await Promise.all([
    getPortfolioData(supabase, user.id),
    supabase.from("profiles").select("portfolio_slug, portfolio_public").eq("id", user.id).single(),
  ]);
  const shareUrl = shareRow?.portfolio_slug ? await getPortfolioShareUrl(shareRow.portfolio_slug) : null;
  const shares = await listShares(createServiceClient(), user.id);
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const origin = `${h.get("x-forwarded-proto") ?? (host?.startsWith("localhost") ? "http" : "https")}://${host}`;
  const shareable = data.arenaTasks.filter((t) => t.sealed).map((t) => ({ attemptId: t.attemptId, title: t.title, area: t.area, sharedOnPortfolio: t.sealed!.shared }));

  return (
    <div>
      <PageHead title="Portfolio" intro="What you've demonstrated, not what you've claimed. Built automatically from verified work." />

      <div className="flex flex-col gap-5 pt-4">
        <div className="print:hidden">
          <ShareLinkCard initialUrl={shareUrl} initialIsPublic={shareRow?.portfolio_public ?? false} />
        </div>
        <RecruiterShareCard records={shareable} shares={shares} contactAvailable={data.profile.contactShared} origin={origin} />
        <PortfolioBody
          viewer={data.viewer}
          profile={data.profile}
          education={data.education}
          statedRole={data.statedRole}
          groups={data.groups}
          arenaTasks={data.arenaTasks}
          arenaWork={data.arenaWork}
          proficiency={data.proficiency}
          roleReadiness={data.roleReadiness}
          interviews={data.interviews}
          github={data.github}
          items={data.items}
          keyEvidence={data.keyEvidence}
          mostRecent={data.mostRecent}
          elo={data.elo}
          pulseUrl="/api/portfolio/pulse"
          graph={data.graph}
          isOwner
          evidenceBaseUrl="/api/arena/attempts"
        />
      </div>
    </div>
  );
}
