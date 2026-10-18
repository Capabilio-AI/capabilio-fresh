import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { orgPageContext } from "@/lib/org/page";
import { can } from "@/lib/org/roles";
import { loadOrgFacts, loadPlacementWall, loadPublicOrg, loadVisiblePosts } from "@/lib/org/public-org";
import { TABS, type TabId } from "@/components/org/CollegeHeader";
import { CollegeProfileView } from "@/components/org/CollegeProfileView";
import { untyped, type OrgPostRow } from "@/lib/org/db";
import { loadManagedPosts } from "@/lib/org/posts";

export const metadata: Metadata = { title: "College page — Capabilio AI" };

const isTab = (v: string | undefined): v is TabId => TABS.some((t) => t.id === v);

/**
 * The college's own profile, inside the workspace (sidebar and navigation stay). Members always see it, public or not;
 * people with the College-page permission can change the logo, cover and details right here.
 */
export default async function OrgCollegePage({ searchParams }: { searchParams: Promise<{ tab?: string; edit?: string }> }) {
  const { ctx, service } = await orgPageContext();
  const sp = await searchParams;
  const tab: TabId = isTab(sp.tab) ? sp.tab : "home";
  const org = await loadPublicOrg(service, ctx.institutionSlug, ctx.userId);
  if (!org) notFound();
  const canManagePosts = can(ctx, "publishPost");
  const [published, drafts, wall, facts] = await Promise.all([
    loadVisiblePosts(service, org, ctx.userId),
    // drafts and unpublished posts are only listed here, for the people who manage them
    canManagePosts ? loadManagedPosts(service, ctx).then((all) => all.filter((p) => p.status === "draft")) : Promise.resolve([]),
    loadPlacementWall(service, org.institutionId),
    loadOrgFacts(service, org.institutionId),
  ]);
  const posts = [...drafts, ...published];

  // posts this member may edit or delete: everything for admins, otherwise only their own
  const ids = posts.map((p) => p.id);
  let manageable = new Set<string>();
  if (can(ctx, "publishPost") && ids.length) {
    if (ctx.kind === "admin") manageable = new Set(ids);
    else {
      const { data } = await untyped(service).from("org_posts").select("id, author_membership_id").in("id", ids);
      manageable = new Set(((data ?? []) as Pick<OrgPostRow, "id" | "author_membership_id">[]).filter((p) => p.author_membership_id === ctx.membershipId).map((p) => p.id));
    }
  }

  return (
    <div>
      <CollegeProfileView
        org={org}
        facts={facts}
        wall={wall}
        posts={posts}
        tab={tab}
        signedIn
        basePath="/org/college"
        workspace
        canEditPage={can(ctx, "manageProfile")}
        canPost={can(ctx, "publishPost")}
        manageablePostIds={manageable}
        openEdit={sp.edit === "1"}
      />
    </div>
  );
}
