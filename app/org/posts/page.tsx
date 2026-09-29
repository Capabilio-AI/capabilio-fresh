import type { Metadata } from "next";
import Link from "next/link";
import { orgPageContext } from "@/lib/org/page";
import { loadManagedPosts } from "@/lib/org/posts";
import { untyped, type OrgProfileRow } from "@/lib/org/db";
import { PostComposer } from "@/components/org/PostComposer";
import { PostCard } from "@/components/org/PostCard";
import { EmptyState, PageHeader } from "@/components/org/ui";

export const metadata: Metadata = { title: "Posts — Capabilio AI" };

export default async function OrgPostsPage() {
  const { ctx, service } = await orgPageContext("publishPost");
  const [posts, profileRes] = await Promise.all([loadManagedPosts(service, ctx), untyped(service).from("org_profiles").select("*").eq("institution_id", ctx.institutionId).maybeSingle()]);
  const profile = (profileRes.data as OrgProfileRow | null) ?? null;
  const drafts = posts.filter((p) => p.status === "draft").length;

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-5">
      <PageHeader
        title="Posts"
        subtitle={
          ctx.kind === "admin"
            ? "Share news, photos and events as your college. Posts appear on your college page and reach students who follow it."
            : "Your posts appear on the college page. You can edit or delete only your own."
        }
      />
      <PostComposer orgName={ctx.institutionName} logoUrl={profile?.logo_url ?? null} />
      {!profile?.is_public && (
        <p className="rounded-xl border border-app-border bg-white/[0.03] px-4 py-3 text-[12.5px] text-app-muted">
          Your college page isn&apos;t public yet, so only signed-in members of {ctx.institutionName} can see these posts.{" "}
          {ctx.permissions.has("page") && (
            <Link href="/org/college?edit=1" className="font-semibold text-app-orange hover:underline">
              Publish the page
            </Link>
          )}
        </p>
      )}
      {drafts > 0 && <p className="text-[12.5px] text-app-muted">{drafts} draft{drafts === 1 ? "" : "s"} — open the ⋯ menu on a draft to publish it.</p>}
      {posts.length === 0 ? (
        <EmptyState title="You haven't posted yet" body="Start with a short announcement or a photo from campus." />
      ) : (
        posts.map((p) => <PostCard key={p.id} post={p} slug={ctx.institutionSlug} orgName={ctx.institutionName} logoUrl={profile?.logo_url ?? null} manage />)
      )}
    </div>
  );
}
