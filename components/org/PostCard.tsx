import Link from "next/link";
import { CalendarDays, MapPin } from "lucide-react";
import type { PublicPost } from "@/lib/org/public-org";
import { LikeButton, RsvpButton, ShareButton } from "./SocialButtons";
import { Pill, formatDateTime } from "./ui";

export function PostCard({ post, slug, permalink = true }: { post: PublicPost; slug: string; permalink?: boolean }) {
  const path = `/o/${slug}/posts/${post.id}`;
  return (
    <article className="o-card p-5">
      <div className="flex items-center gap-2">
        <Pill tone={post.type === "event" ? "warn" : "neutral"}>{post.type}</Pill>
        {post.type === "announcement" && !post.is_public && <Pill>Members only</Pill>}
      </div>
      <h3 className="mt-2 o-serif text-[26px] leading-tight text-app-charcoal">
        {permalink ? (
          <Link href={path} className="hover:underline">
            {post.title}
          </Link>
        ) : (
          post.title
        )}
      </h3>
      {post.type === "event" && (
        <p className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1 font-lp-mono text-[11.5px] text-app-muted">
          <span className="inline-flex items-center gap-1">
            <CalendarDays size={12} />
            {formatDateTime(post.event_starts_at)}
          </span>
          {post.event_location && (
            <span className="inline-flex items-center gap-1">
              <MapPin size={12} />
              {post.event_location}
            </span>
          )}
        </p>
      )}
      <p className="mt-3 whitespace-pre-wrap font-lp-body text-[13.5px] text-app-charcoal">{post.body}</p>
      {post.event_link && (
        <a href={post.event_link} target="_blank" rel="noopener noreferrer" className="mt-2 inline-block font-lp-body text-[13px] text-app-blue hover:underline">
          Event link
        </a>
      )}
      <div className="mt-4 flex items-center gap-2">
        {post.type === "event" && <RsvpButton postId={post.id} going={post.rsvpedByViewer} count={post.rsvpCount} />}
        <LikeButton postId={post.id} liked={post.likedByViewer} count={post.likeCount} />
        <ShareButton path={path} />
      </div>
    </article>
  );
}
