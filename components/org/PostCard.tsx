import Link from "next/link";
import { BadgeCheck, ExternalLink, Globe, Lock, MapPin } from "lucide-react";
import type { PublicPost } from "@/lib/org/public-org";
import { initialsOf, timeAgo } from "@/lib/org/format";
import { LikeButton, RsvpButton, ShareButton } from "./SocialButtons";
import { PostMenu } from "./PostMenu";
import { kindOf } from "./post-kinds";
import { Pill, formatDateTime } from "./ui";

/** A college post in the Pulse feed style: author row with a kind chip, headline, text, poster or photo, event details, then like / attend / share. */
export function PostCard({
  post,
  slug,
  orgName,
  logoUrl,
  verified = true,
  permalink = true,
  manage = false,
}: {
  post: PublicPost;
  slug: string;
  orgName: string;
  logoUrl: string | null;
  verified?: boolean;
  permalink?: boolean;
  /** show the edit / publish / delete menu (the viewer may manage this post) */
  manage?: boolean;
}) {
  const path = `/o/${slug}/posts/${post.id}`;
  const kind = kindOf(post);
  const KindIcon = kind.icon;
  const dated = post.type === "event" && Boolean(post.event_starts_at);
  const start = dated ? new Date(post.event_starts_at as string) : null;
  const headline = post.title && post.title !== post.body.split("\n")[0].slice(0, 200) ? post.title : null;
  const isPoster = kind.id === "poster";

  return (
    <article className="o-card overflow-hidden p-5">
      <header className="flex items-start gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
          <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-full object-cover" />
        ) : (
          <span className="o-logo-tile h-11 w-11 shrink-0 rounded-full text-[14px]" aria-hidden="true">
            {initialsOf(orgName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-1.5 truncate text-[14px] font-bold text-app-charcoal">
            {orgName}
            {verified && <BadgeCheck size={14} className="shrink-0 text-app-blue" aria-label="Verified by Capabilio" />}
          </p>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[12px] text-app-muted">
            {permalink ? (
              <Link href={path} className="hover:underline">
                {timeAgo(post.published_at ?? post.created_at)}
              </Link>
            ) : (
              <span>{timeAgo(post.published_at ?? post.created_at)}</span>
            )}
            <span className="inline-flex items-center gap-1">
              {post.is_public ? <Globe size={11} aria-hidden="true" /> : <Lock size={11} aria-hidden="true" />}
              {post.is_public ? "Anyone" : "Members only"}
            </span>
            {post.status === "draft" && <Pill tone="warn">Draft</Pill>}
          </p>
        </div>
        <span className={`flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-semibold ${kind.chip}`}>
          <KindIcon size={11} aria-hidden="true" /> {kind.label}
        </span>
        {manage && <PostMenu postId={post.id} status={post.status} body={post.body} />}
      </header>

      {dated && start && (
        <div className="mt-4 flex items-center gap-3.5">
          <span className="o-date" aria-hidden="true">
            <b>{start.toLocaleDateString("en-IN", { day: "2-digit" })}</b>
            <span>{start.toLocaleDateString("en-IN", { month: "short" })}</span>
          </span>
          <div className="min-w-0">
            {headline && <h3 className="text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-app-charcoal">{headline}</h3>}
            <p className="mt-0.5 flex flex-wrap items-center gap-x-3 gap-y-0.5 text-[12.5px] text-app-muted">
              <span>{formatDateTime(post.event_starts_at)}</span>
              {post.event_location && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={12} aria-hidden="true" /> {post.event_location}
                </span>
              )}
            </p>
          </div>
        </div>
      )}
      {!dated && headline && <h3 className="mt-4 text-[19px] font-extrabold leading-tight tracking-[-0.02em] text-app-charcoal">{headline}</h3>}

      <p className={`whitespace-pre-wrap text-[14px] leading-relaxed text-app-charcoal ${dated || headline ? "mt-2.5" : "mt-4"}`}>{post.body}</p>

      {post.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded image from our own storage bucket
        <img src={post.cover_image_url} alt="" loading="lazy" className={`mt-4 w-full rounded-2xl border border-app-border object-cover ${isPoster ? "max-h-[600px] bg-black/5" : "max-h-[420px]"}`} />
      )}

      {post.event_link && (
        <a href={post.event_link} target="_blank" rel="noopener noreferrer" className="o-btn-ghost mt-3 !inline-flex">
          <ExternalLink size={14} aria-hidden="true" /> {kind.id === "admissions" ? "Apply" : dated ? "Register" : "Open link"}
        </a>
      )}

      {post.status === "published" && (
        <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-app-border pt-3">
          {dated && <RsvpButton postId={post.id} going={post.rsvpedByViewer} count={post.rsvpCount} />}
          <LikeButton postId={post.id} liked={post.likedByViewer} count={post.likeCount} />
          <ShareButton path={path} />
        </footer>
      )}
    </article>
  );
}
