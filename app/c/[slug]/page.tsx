import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadPublicCompany } from "@/lib/company/public";
import { CompanyPublicPage } from "@/components/company/public/CompanyPublicPage";
import { safeJsonLd } from "@/lib/hiring/format";

export const dynamic = "force-dynamic"; // follower counts, likes and open roles change at any moment

export async function generateMetadata({ params }: { params: Promise<{ slug: string }> }): Promise<Metadata> {
  const { slug } = await params;
  const data = await loadPublicCompany(createServiceClient(), slug, null);
  if (!data) return { title: "Company — Capabilio AI" };
  const { org } = data;
  const description = org.profile?.tagline ?? org.profile?.bio?.slice(0, 160) ?? `${org.name} on Capabilio AI`;
  const image = org.profile?.cover_image_url ?? org.profile?.logo_url;
  return {
    title: `${org.name} — Capabilio AI`,
    description,
    openGraph: { title: org.name, description, type: "website", ...(image ? { images: [image] } : {}) },
  };
}

/** A company's public page. Public only when the company opted in; otherwise only its own members see it (404 for everyone else). */
export default async function CompanyPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await getAuthedUser();
  const data = await loadPublicCompany(createServiceClient(), slug, user?.id ?? null);
  if (!data) notFound();
  const { org } = data;
  const jsonLd = { "@context": "https://schema.org", "@type": "Organization", name: org.name, ...(org.profile?.website_url ? { url: org.profile.website_url } : {}), ...(org.profile?.logo_url ? { logo: org.profile.logo_url } : {}), ...(org.profile?.tagline ? { description: org.profile.tagline } : {}) };
  return (
    <>
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: safeJsonLd(jsonLd) }} />
      <CompanyPublicPage data={data} signedIn={Boolean(user)} />
    </>
  );
}
