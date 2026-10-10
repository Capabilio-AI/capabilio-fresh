import type { Metadata } from "next";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { getPortfolioData } from "@/lib/portfolio/data";
import { PageHead } from "@/components/dashboard/PageHead";
import { PortfolioBody } from "@/components/portfolio/PortfolioBody";
import { ShareLinkCard } from "@/components/portfolio/ShareLinkCard";
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

  return (
    <div>
      <PageHead title="Portfolio" intro="What you've demonstrated, not what you've claimed. Built automatically from verified work." />

      <div className="flex flex-col gap-5 pt-4">
        <div className="print:hidden">
          <ShareLinkCard initialUrl={shareUrl} initialIsPublic={shareRow?.portfolio_public ?? false} />
        </div>
        <PortfolioBody
          viewer={data.viewer}
          profile={data.profile}
          education={data.education}
          statedRole={data.statedRole}
          groups={data.groups}
          arenaTasks={data.arenaTasks}
          interviews={data.interviews}
          github={data.github}
          items={data.items}
          keyEvidence={data.keyEvidence}
          mostRecent={data.mostRecent}
          elo={data.elo}
          graph={data.graph}
          isOwner
          evidenceBaseUrl="/api/arena/attempts"
        />
      </div>
    </div>
  );
}
