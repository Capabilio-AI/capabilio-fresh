import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { getAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadOrgFacts, loadPlacementWall, loadPublicOrg, loadVisiblePosts } from "@/lib/org/public-org";
import { TABS, type TabId } from "@/components/org/CollegeHeader";
import { CollegeProfileView } from "@/components/org/CollegeProfileView";
import { OrgTheme } from "@/components/org/OrgTheme";

export const metadata: Metadata = { title: "College — Capabilio AI" };

const isTab = (v: string | undefined): v is TabId => TABS.some((t) => t.id === v);

/** The college's page as visitors see it. Public only when the college opted in; otherwise members-only (404 for others). */
export default async function OrgPublicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tab: TabId = isTab(sp.tab) ? sp.tab : "home";
  const { user } = await getAuthedUser();
  const service = createServiceClient();
  const org = await loadPublicOrg(service, slug, user?.id ?? null);
  if (!org) notFound();
  const [posts, wall, facts] = await Promise.all([loadVisiblePosts(service, org, user?.id ?? null), loadPlacementWall(service, org.institutionId), loadOrgFacts(service, org.institutionId)]);

  return (
    <OrgTheme>
      <CollegeProfileView org={org} facts={facts} wall={wall} posts={posts} tab={tab} signedIn={Boolean(user)} basePath={`/o/${org.slug}`} />
    </OrgTheme>
  );
}
