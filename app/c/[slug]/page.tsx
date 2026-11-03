import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { loadPublicCompany } from "@/lib/company/public";
import { COMPANY_TABS, CompanyPublicPage, type CompanyTabId } from "@/components/company/public/CompanyPublicPage";
import { OrgTheme } from "@/components/org/OrgTheme";
import { StudentBar } from "@/components/org/StudentBar";
import { safeJsonLd } from "@/lib/hiring/format";

export const dynamic = "force-dynamic"; // follower counts, likes and open roles change at any moment

const isTab = (v: string | undefined): v is CompanyTabId => COMPANY_TABS.some((t) => t.id === v);

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicCompany(createServiceClient(), slug, null);
  if (!data) return { title: "Company — Capabilio AI" };
  const { org } = data;
  const description = org.profile?.tagline ?? org.profile?.bio?.slice(0, 160) ?? `${org.name} on Capabilio AI`;
  const image = org.profile?.cover_image_url ?? org.profile?.logo_url;
  return { title: `${org.name} — Capabilio AI`, description, openGraph: { title: org.name, description, type: "website", ...(image ? { images: [image] } : {}) } };
}

/** A company's public page. Public only when the company opted in; otherwise only its own members see it (404 for everyone else). */
export default async function CompanyPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tab: CompanyTabId = isTab(sp.tab) ? sp.tab : "home";
  const { supabase, user } = await getAuthedUser();
  const data = await loadPublicCompany(createServiceClient(), slug, user?.id ?? null);
  if (!data) notFound();
  const { org } = data;
  const member = user ? await getOrgContext(supabase, user.id) : null;
  const workspace = member && member.kind !== "student" ? member : null;
  const jsonLd = { "@context": "https://schema.org", "@type": "Organization", name: org.name, ...(org.profile?.website_url ? { url: org.profile.website_url } : {}), ...(org.profile?.logo_url ? { logo: org.profile.logo_url } : {}), ...(org.profile?.tagline ? { description: org.profile.tagline } : {}) };
  return (
    <OrgTheme visitor>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      {workspace && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-app-border bg-[#fff]/90 px-4 py-2.5 backdrop-blur">
          <Link href={workspace.institutionId === org.institutionId ? "/company/profile" : "/org"} className="o-btn-ghost !h-9 !px-3">
            <ArrowLeft size={14} aria-hidden="true" /> Back to workspace
          </Link>
          <span className="text-[12px] text-app-muted">You are viewing this page as a visitor sees it.</span>
        </div>
      )}
      {user && !workspace && <StudentBar />}
      <CompanyPublicPage data={data} tab={tab} signedIn={Boolean(user)} />
    </OrgTheme>
  );
}
