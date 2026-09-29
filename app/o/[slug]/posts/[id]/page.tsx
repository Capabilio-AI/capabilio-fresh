import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { getAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadPublicOrg, loadVisiblePosts } from "@/lib/org/public-org";
import { OrgTheme } from "@/components/org/OrgTheme";
import { PostCard } from "@/components/org/PostCard";

export const metadata: Metadata = { title: "Post — Capabilio AI" };

const UUID = /^[0-9a-f-]{36}$/i;

/** The shareable permalink. Same visibility rules as the page: a post the viewer may not see is a plain 404. */
export default async function OrgPostPage({ params }: { params: Promise<{ slug: string; id: string }> }) {
  const { slug, id } = await params;
  if (!UUID.test(id)) notFound();
  const { user } = await getAuthedUser();
  const service = createServiceClient();
  const org = await loadPublicOrg(service, slug, user?.id ?? null);
  if (!org) notFound();
  const [post] = await loadVisiblePosts(service, org, user?.id ?? null, id);
  if (!post) notFound();

  return (
    <OrgTheme>
      <main className="mx-auto max-w-2xl px-4 py-10">
        <Link href={`/o/${org.slug}`} className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-app-muted hover:text-app-charcoal">
          <ArrowLeft size={14} aria-hidden="true" /> {org.name}
        </Link>
        <div className="mt-5">
          <PostCard post={post} slug={org.slug} permalink={false} />
        </div>
      </main>
    </OrgTheme>
  );
}
