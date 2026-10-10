import { MetroScope } from "@/components/metro/MetroScope";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { getPortfolioData } from "@/lib/portfolio/data";
import { PortfolioBody } from "@/components/portfolio/PortfolioBody";

export const dynamic = "force-dynamic"; // a live record: never serve a cached copy

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const service = createServiceClient();
  const { data: profile } = await service.from("profiles").select("full_name").eq("portfolio_slug", slug).eq("portfolio_public", true).maybeSingle();
  return { title: profile ? `${profile.full_name ?? "Portfolio"} — Capabilio AI` : "Portfolio — Capabilio AI" };
}

/**
 * Public, read-only portfolio — the link a student shares with recruiters.
 * No session required; access is gated entirely on the owner's own
 * portfolio_public flag, checked here with the service client (bypasses
 * RLS, which is scoped to the signed-in user and would otherwise block
 * every field an anonymous visitor needs to see).
 */
export default async function PublicPortfolioPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const service = createServiceClient();

  const { data: profile } = await service.from("profiles").select("id, portfolio_public").eq("portfolio_slug", slug).maybeSingle();
  if (!profile?.portfolio_public) notFound();

  const data = await getPortfolioData(service, profile.id, { publicView: true });

  return (
    <MetroScope>
    <div className="min-h-screen bg-app-background px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-5xl">
        <p className="mb-4 font-lp-body text-[13px] text-app-muted print:hidden">Verified by Capabilio AI. Every score and piece of work below links to graded evidence.</p>

        <div>
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
            isOwner={false}
            evidenceBaseUrl={`/api/portfolio/${slug}/attempts`}
          />
        </div>
      </div>
    </div>
    </MetroScope>
  );
}
