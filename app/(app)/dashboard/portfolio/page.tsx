import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getPortfolioData } from "@/lib/portfolio/data";
import { DashboardSubNav } from "@/components/dashboard/DashboardSubNav";
import { PortfolioBody } from "@/components/portfolio/PortfolioBody";
import { ShareLinkCard } from "@/components/portfolio/ShareLinkCard";
import { getPortfolioShareUrl } from "./actions";

export const metadata: Metadata = { title: "Portfolio — Capabilio AI" };

/**
 * Evidence-first portfolio, following capabilio-web's order (hero → recruiter
 * snapshot → capabilities & evidence → Arena → GitHub → projects/certificates)
 * but showing only sections backed by real data. No bare ratings, levels or
 * scores — every capability line is a count of real evidence.
 */
export default async function PortfolioPage() {
  const { supabase, user } = await requireAuthedUser();

  const [data, { data: shareRow }] = await Promise.all([
    getPortfolioData(supabase, user.id),
    supabase.from("profiles").select("portfolio_slug, portfolio_public").eq("id", user.id).single(),
  ]);
  const shareUrl = shareRow?.portfolio_slug ? await getPortfolioShareUrl(shareRow.portfolio_slug) : null;

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">Portfolio</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">What you&apos;ve demonstrated, not what you&apos;ve claimed. Built automatically from verified work.</p>
      <div className="mt-4">
        <DashboardSubNav />
      </div>

      <div className="flex flex-col gap-5 pt-6">
        <ShareLinkCard initialUrl={shareUrl} initialIsPublic={shareRow?.portfolio_public ?? false} />
        <PortfolioBody
          viewer={data.viewer}
          statedRole={data.statedRole}
          groups={data.groups}
          arenaTasks={data.arenaTasks}
          github={data.github}
          items={data.items}
          keyEvidence={data.keyEvidence}
          mostRecent={data.mostRecent}
          isOwner
          evidenceBaseUrl="/api/arena/attempts"
        />
      </div>
    </div>
  );
}
