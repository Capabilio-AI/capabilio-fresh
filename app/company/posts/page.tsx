import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { getOrgContext } from "@/lib/org/context";
import { untyped, type OrgPostRow } from "@/lib/org/db";
import { PostsManager, type ManagedPost } from "@/components/company/PostsManager";

export const metadata: Metadata = { title: "Posts — Company — Capabilio AI" };

export default async function CompanyPostsPage() {
  const { supabase, user } = await requireAuthedUser();
  const ctx = await getOrgContext(supabase, user.id);
  if (!ctx || ctx.kind !== "company") redirect("/company");
  const db = untyped(createServiceClient());
  const { data } = await db.from("org_posts").select("*").eq("institution_id", ctx.institutionId).order("created_at", { ascending: false }).limit(100);
  const rows = (data ?? []) as OrgPostRow[];
  const ids = rows.map((r) => r.id);
  const { data: likes } = ids.length ? await db.from("org_post_likes").select("post_id").in("post_id", ids) : { data: [] };
  const counts = new Map<string, number>();
  for (const l of (likes ?? []) as { post_id: string }[]) counts.set(l.post_id, (counts.get(l.post_id) ?? 0) + 1);
  const posts: ManagedPost[] = rows.map((r) => ({ id: r.id, type: r.type, title: r.title, body: r.body, status: r.status, isPublic: r.is_public, publishedAt: r.published_at, createdAt: r.created_at, likeCount: counts.get(r.id) ?? 0 }));
  return (
    <div className="mx-auto max-w-3xl">
      <h1 className="font-lp-display text-[30px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[40px]">Posts</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">Share updates, hiring news and milestones. Followers are notified when you publish.</p>
      <div className="pt-6"><PostsManager posts={posts} /></div>
    </div>
  );
}
