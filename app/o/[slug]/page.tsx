import type { Metadata } from "next";
import { notFound } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getOrgContext } from "@/lib/org/context";
import { getAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadPublicOrg, loadVisiblePosts } from "@/lib/org/public-org";
import { PUBLIC_TABS, PublicCollegePage, type PublicTabId } from "@/components/org/PublicCollegePage";
import { OrgTheme } from "@/components/org/OrgTheme";

export const metadata: Metadata = { title: "College — Capabilio AI" };

const isTab = (v: string | undefined): v is PublicTabId => PUBLIC_TABS.some((t) => t.id === v);

/** The college's page as visitors see it. Public only when the college opted in; otherwise members-only (404 for others). */
export default async function OrgPublicPage({ params, searchParams }: { params: Promise<{ slug: string }>; searchParams: Promise<{ tab?: string }> }) {
  const [{ slug }, sp] = await Promise.all([params, searchParams]);
  const tab: PublicTabId = isTab(sp.tab) ? sp.tab : "home";
  const { supabase, user } = await getAuthedUser();
  const service = createServiceClient();
  const org = await loadPublicOrg(service, slug, user?.id ?? null);
  if (!org) notFound();
  const member = user ? await getOrgContext(supabase, user.id) : null;
  const workspace = member && member.kind !== "student" ? member : null;
  // A visitor sees posts, events and the follower count only: no student counts, departments or placement records are even loaded.
  const posts = await loadVisiblePosts(service, org, user?.id ?? null);

  return (
    <OrgTheme visitor>
      {workspace && (
        <div className="sticky top-0 z-30 flex items-center justify-between gap-3 border-b border-app-border bg-[#fff]/90 px-4 py-2.5 backdrop-blur">
          <Link href={workspace.institutionId === org.institutionId ? "/org/college" : "/org"} className="o-btn-ghost !h-9 !px-3">
            <ArrowLeft size={14} aria-hidden="true" /> Back to workspace
          </Link>
          <span className="text-[12px] text-app-muted">You are viewing this page as a visitor sees it.</span>
        </div>
      )}
      <PublicCollegePage org={org} posts={posts} tab={tab} signedIn={Boolean(user)} />
    </OrgTheme>
  );
}
