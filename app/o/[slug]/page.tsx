import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BadgeCheck, Globe } from "lucide-react";
import { getAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { loadPlacementWall, loadPublicOrg, loadVisiblePosts } from "@/lib/org/public-org";
import { FollowButton } from "@/components/org/SocialButtons";
import { PostCard } from "@/components/org/PostCard";
import { EmptyState } from "@/components/org/ui";

export const metadata: Metadata = { title: "Organisation — Capabilio AI" };

/** Public only when the organisation opted in (org_profiles.is_public) — otherwise members-only, and anyone else gets a 404. */
export default async function OrgPublicPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const { user } = await getAuthedUser();
  const service = createServiceClient();
  const org = await loadPublicOrg(service, slug, user?.id ?? null);
  if (!org) notFound();
  const [posts, wall] = await Promise.all([loadVisiblePosts(service, org, user?.id ?? null), loadPlacementWall(service, org.institutionId)]);
  const place = [org.city, org.state].filter(Boolean).join(", ");

  return (
    <main className="min-h-screen bg-app-background">
      <div className="mx-auto max-w-3xl px-4 py-10">
        {org.profile?.cover_image_url && (
          // eslint-disable-next-line @next/next/no-img-element -- admin-supplied external URL, no fixed domain to whitelist
          <img src={org.profile.cover_image_url} alt="" className="mb-6 h-48 w-full rounded-xl border border-app-border object-cover" />
        )}
        <header className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <h1 className="flex items-center gap-2 font-lp-display text-[28px] font-semibold text-app-charcoal">
              {org.name}
              {org.verified && (
                <span title="Reviewed and approved by the Capabilio team" className="inline-flex items-center gap-1 rounded-full bg-app-blue-container px-2 py-0.5 font-lp-mono text-[11px] font-semibold text-app-blue">
                  <BadgeCheck size={13} /> Verified
                </span>
              )}
            </h1>
            <p className="font-lp-mono text-[12px] text-app-muted">
              {[place, org.studentCount > 0 ? `${org.studentCount} students on Capabilio` : ""].filter(Boolean).join(" · ")}
            </p>
            {org.profile?.website_url && (
              <a href={org.profile.website_url} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex items-center gap-1 font-lp-body text-[13px] text-app-blue hover:underline">
                <Globe size={13} /> Website
              </a>
            )}
          </div>
          {user ? (
            <FollowButton slug={org.slug} following={org.isFollowing} followerCount={org.followerCount} />
          ) : (
            <Link href="/login" className="rounded-full border border-app-border bg-white px-3 py-1.5 font-lp-body text-[12.5px] font-medium text-app-charcoal hover:bg-black/5">
              Sign in to follow · {org.followerCount}
            </Link>
          )}
        </header>
        {org.profile?.bio && <p className="mt-4 whitespace-pre-wrap font-lp-body text-[14px] text-app-charcoal">{org.profile.bio}</p>}

        {wall.length > 0 && (
          <section aria-label="Placement wall" className="mt-10">
            <h2 className="mb-3 font-lp-body text-[15px] font-semibold text-app-charcoal">Placement wall</h2>
            <ul className="grid grid-cols-1 gap-2 sm:grid-cols-2">
              {wall.map((w) => (
                <li key={w.id} className="rounded-xl border border-app-border bg-white px-4 py-3">
                  <p className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{w.name}</p>
                  <p className="font-lp-body text-[12.5px] text-app-muted">
                    {w.roleTitle} · {w.company}
                  </p>
                </li>
              ))}
            </ul>
            <p className="mt-2 font-lp-body text-[11.5px] text-app-muted">Shown only with each student&apos;s own consent.</p>
          </section>
        )}

        <h2 className="mb-3 mt-10 font-lp-body text-[15px] font-semibold text-app-charcoal">Events & announcements</h2>
        {posts.length === 0 ? (
          <EmptyState title="Nothing posted yet" body="Published events and announcements appear here." />
        ) : (
          <div className="flex flex-col gap-4">
            {posts.map((p) => (
              <PostCard key={p.id} post={p} slug={org.slug} />
            ))}
          </div>
        )}
      </div>
    </main>
  );
}
