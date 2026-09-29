import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { createServiceClient } from "@/lib/supabase/service";
import { getPortfolioData } from "@/lib/portfolio/data";
import { PortfolioBody } from "@/components/portfolio/PortfolioBody";

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

  const data = await getPortfolioData(service, profile.id);

  return (
    <div className="min-h-screen bg-app-background px-4 py-10 sm:px-8">
      <div className="mx-auto max-w-4xl">
        <p className="font-lp-mono text-[11px] uppercase tracking-wide text-app-muted">Capabilio AI · Verified portfolio</p>
        <h1 className="mt-1 font-lp-display text-[26px] font-semibold text-app-charcoal">Portfolio</h1>
        <p className="mt-1 font-lp-body text-[13px] text-app-muted">What this candidate has demonstrated, not what they&apos;ve claimed. Every item below links to verifiable evidence.</p>

        <div className="pt-6">
          <PortfolioBody
            viewer={data.viewer}
            statedRole={data.statedRole}
            groups={data.groups}
            arenaTasks={data.arenaTasks}
            github={data.github}
            items={data.items}
            keyEvidence={data.keyEvidence}
            mostRecent={data.mostRecent}
            isOwner={false}
            evidenceUrl={(attemptId) => `/api/portfolio/${slug}/attempts/${attemptId}`}
          />
        </div>
      </div>
    </div>
  );
}
