import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import type { PublicPost } from "@/lib/org/public-org";
import { initialsOf, timeAgo } from "@/lib/org/format";
import { LikeButton, RsvpButton, ShareButton } from "./SocialButtons";
import { PostMenu } from "./PostMenu";
import { Pill, formatDateTime } from "./ui";

/** A LinkedIn-style post: author row, text, photo, event details, then like / attend / share. */
export function PostCard({
  post,
  slug,
  orgName,
  logoUrl,
  permalink = true,
  manage = false,
}: {
  post: PublicPost;
  slug: string;
  orgName: string;
  logoUrl: string | null;
  permalink?: boolean;
  /** show the edit / publish / delete menu (the viewer may manage this post) */
  manage?: boolean;
}) {
  const path = `/o/${slug}/posts/${post.id}`;
  const isEvent = post.type === "event";
  return (
    <article className="o-card p-5">
      <header className="flex items-start gap-3">
        {logoUrl ? (
          // eslint-disable-next-line @next/next/no-img-element -- our own storage URL
          <img src={logoUrl} alt="" className="h-11 w-11 shrink-0 rounded-xl object-cover" />
        ) : (
          <span className="o-logo-tile h-11 w-11 shrink-0 rounded-xl text-[14px]" aria-hidden="true">
            {initialsOf(orgName)}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="truncate text-[14px] font-bold text-app-charcoal">{orgName}</p>
          <p className="flex flex-wrap items-center gap-x-2 text-[11.5px] text-app-muted">
            {permalink ? (
              <Link href={path} className="hover:underline">
                {timeAgo(post.published_at ?? post.created_at)}
              </Link>
            ) : (
              <span>{timeAgo(post.published_at ?? post.created_at)}</span>
            )}
            {post.status === "draft" && <Pill tone="warn">Draft</Pill>}
            {isEvent && <Pill tone="info">Event</Pill>}
            {!isEvent && !post.is_public && <span>· Members only</span>}
          </p>
        </div>
        {manage && <PostMenu postId={post.id} status={post.status} body={post.body} />}
      </header>

      {isEvent && (
        <h3 className="o-serif mt-4 text-[26px] leading-tight text-app-charcoal">{post.title}</h3>
      )}
      <p className={`whitespace-pre-wrap text-[14px] leading-relaxed text-app-charcoal ${isEvent ? "mt-2" : "mt-4"}`}>{post.body}</p>

      {isEvent && (
        <p className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px] text-app-muted">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays size={13} aria-hidden="true" />
            {formatDateTime(post.event_starts_at)}
          </span>
          {post.event_location && (
            <span className="inline-flex items-center gap-1.5">
              <MapPin size={13} aria-hidden="true" />
              {post.event_location}
            </span>
          )}
          {post.event_link && (
            <a href={post.event_link} target="_blank" rel="noopener noreferrer" className="text-app-blue hover:underline">
              Event link
            </a>
          )}
        </p>
      )}

      {post.cover_image_url && (
        // eslint-disable-next-line @next/next/no-img-element -- admin-uploaded image from our own storage bucket
        <img src={post.cover_image_url} alt="" className="mt-4 max-h-[420px] w-full rounded-xl border border-app-border object-cover" />
      )}

      {post.status === "published" && (
        <footer className="mt-4 flex flex-wrap items-center gap-2 border-t border-app-border pt-3">
          {isEvent && <RsvpButton postId={post.id} going={post.rsvpedByViewer} count={post.rsvpCount} />}
          <LikeButton postId={post.id} liked={post.likedByViewer} count={post.likeCount} />
          <ShareButton path={path} />
        </footer>
      )}
    </article>
  );
}
