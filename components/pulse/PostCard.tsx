"use client";

import { useState } from "react";
import Link from "next/link";
import { Award, Ban, BookmarkPlus, Briefcase, Flag, Flame, Heart, HelpCircle, Loader2, MessageCircle, MoreHorizontal, Send, Sparkles, Target, Trash2, Users } from "lucide-react";
import clsx from "clsx";
import type { PulseComment, PulsePost } from "@/lib/pulse/data";
import { relativeTime, type PostKind } from "@/lib/pulse/format";
import { Avatar } from "./Avatar";
import { MentorBadge } from "./MentorBadge";
import { AttachmentCard, PostBody } from "./PostBody";
import { ReportDialog } from "./ReportDialog";

const KIND: Record<PostKind, { label: string; icon: typeof Send; bar: string; chip: string } | null> = {
  post: null,
  project: { label: "Project", icon: Sparkles, bar: "bg-app-blue", chip: "bg-app-blue-container text-app-blue" },
  question: { label: "Question", icon: HelpCircle, bar: "bg-app-warning", chip: "bg-app-warning-container text-app-warning" },
  achievement: { label: "Achievement", icon: Award, bar: "bg-app-success", chip: "bg-app-success-container text-app-success" },
  opportunity: { label: "Opportunity", icon: Briefcase, bar: "bg-app-blue", chip: "bg-app-blue-container text-app-blue" },
  resource: { label: "Resource", icon: BookmarkPlus, bar: "bg-app-success", chip: "bg-app-success-container text-app-success" },
};

/** Why a post is in the feed, with an icon that matches the reason. */
function Reason({ text }: { text: string }) {
  const Icon = /^Trending/.test(text) ? Flame : /^From someone/.test(text) ? Users : Target;
  return <p className="mb-2 flex items-center gap-1.5 font-lp-body text-[11.5px] font-medium text-app-muted"><Icon size={12} className="text-app-orange" aria-hidden="true" /> {text}</p>;
}

/** What replies to a post are called: a question gets answers. */
const REPLY: Record<PostKind, { noun: string; placeholder: string }> = {
  post: { noun: "comments", placeholder: "Add a comment…" },
  project: { noun: "comments", placeholder: "Give feedback or ask about it…" },
  question: { noun: "answers", placeholder: "Write an answer…" },
  achievement: { noun: "comments", placeholder: "Congratulate them…" },
  opportunity: { noun: "comments", placeholder: "Ask a question or say you're interested…" },
  resource: { noun: "comments", placeholder: "Add your take or a related link…" },
};

interface PostCardProps {
  post: PulsePost;
  viewerId: string;
  /** where this post's comments and deletes live */
  apiBase?: string;
  /** the viewer may delete it: the author, or a moderator of the community */
  canDelete?: boolean;
  reportType?: "post" | "community_post";
  onToggleLike: () => void;
  onComment: (c: PulseComment) => void;
  onHideAuthor: (authorId: string) => void;
  onDeleted?: (postId: string) => void;
}

export function PostCard({ post, viewerId, apiBase = "/api/pulse/posts", canDelete = false, reportType = "post", onToggleLike, onComment, onHideAuthor, onDeleted }: PostCardProps) {
  const [showComments, setShowComments] = useState(false);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [menu, setMenu] = useState(false);
  const [reporting, setReporting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const kind = KIND[post.kind];
  const mine = post.author.id === viewerId;

  async function sendComment() {
    if (!draft.trim()) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch(`${apiBase}/${post.id}/comments`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ content: draft.trim() }) });
      if (!res.ok) return setError("Couldn't add your comment.");
      onComment(((await res.json()) as { comment: PulseComment }).comment);
      setDraft("");
    } catch {
      setError("Couldn't reach the server.");
    } finally {
      setSending(false);
    }
  }
  async function remove() {
    setMenu(false);
    const res = await fetch(`${apiBase}/${post.id}`, { method: "DELETE" });
    if (res.ok) onDeleted?.(post.id);
    else setError("Couldn't delete the post.");
  }
  async function blockAuthor() {
    setMenu(false);
    const res = await fetch(`/api/pulse/block/${post.author.id}`, { method: "POST" });
    if (res.ok) onHideAuthor(post.author.id);
  }

  return (
    <article className="relative overflow-hidden rounded-2xl border border-[var(--m-rule)] bg-white p-5">
      {kind && <span className={clsx("absolute inset-y-0 left-0 w-1", kind.bar)} aria-hidden="true" />}
      {post.reason && <Reason text={post.reason} />}
      <header className="flex items-start gap-3">
        <Link href={`/pulse/u/${post.author.id}`} aria-label={`${post.author.name ?? "Profile"}`}><Avatar person={post.author} size="md" /></Link>
        <div className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <Link href={`/pulse/u/${post.author.id}`} className="font-lp-body text-[14px] font-semibold text-[var(--m-ink)] hover:underline">{post.author.name ?? "Capabilio member"}</Link>
            {post.author.isMentor && <MentorBadge />}
          </span>
          {post.author.tagline && <p className="truncate font-lp-body text-[12.5px] font-medium text-app-blue">{post.author.tagline}</p>}
          <p className="truncate font-lp-body text-[12px] text-app-muted">{post.author.headline ?? "Capabilio member"} · {relativeTime(post.createdAt)}</p>
        </div>
        {kind && <span className={clsx("flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 font-lp-body text-[11px] font-semibold", kind.chip)}><kind.icon size={11} aria-hidden="true" /> {kind.label}</span>}
        {(!mine || canDelete) && (
          <div className="relative">
            <button type="button" onClick={() => setMenu((m) => !m)} aria-label="More options" aria-expanded={menu} className="rounded-full p-1.5 text-app-muted hover:bg-app-background"><MoreHorizontal size={16} /></button>
            {menu && (
              <div className="absolute right-0 z-10 mt-1 w-44 overflow-hidden rounded-xl border border-[var(--m-rule)] bg-white py-1 shadow-lg">
                {canDelete && <button type="button" onClick={remove} className="flex w-full items-center gap-2 px-3 py-2 text-left font-lp-body text-[13px] text-app-rose hover:bg-app-background"><Trash2 size={13} aria-hidden="true" /> Delete post</button>}
                {!mine && (
                  <>
                    <button type="button" onClick={() => { setMenu(false); setReporting(true); }} className="flex w-full items-center gap-2 px-3 py-2 text-left font-lp-body text-[13px] text-[var(--m-ink)] hover:bg-app-background"><Flag size={13} aria-hidden="true" /> Report post</button>
                    <button type="button" onClick={blockAuthor} className="flex w-full items-center gap-2 px-3 py-2 text-left font-lp-body text-[13px] text-app-rose hover:bg-app-background"><Ban size={13} aria-hidden="true" /> Block {post.author.name?.split(" ")[0] ?? "this person"}</button>
                  </>
                )}
              </div>
            )}
          </div>
        )}
      </header>

      <PostBody kind={post.kind} content={post.content} meta={post.meta} />
      {post.imageUrl && (
        // eslint-disable-next-line @next/next/no-img-element -- short-lived signed storage URL
        <img src={post.imageUrl} alt="Attached to the post" loading="lazy" className="mt-3 max-h-[480px] w-full rounded-xl border border-[var(--m-rule)] object-cover" />
      )}
      {post.attachment && <AttachmentCard file={post.attachment} />}

      <footer className="mt-4 flex items-center gap-5 border-t border-[var(--m-rule)] pt-3">
        <button type="button" onClick={onToggleLike} aria-pressed={post.likedByMe} className={clsx("flex items-center gap-1.5 font-lp-body text-[13px] transition-colors", post.likedByMe ? "text-app-rose" : "text-app-muted hover:text-[var(--m-ink)]")}>
          <Heart size={16} className={post.likedByMe ? "fill-current" : ""} aria-hidden="true" /> {post.likeCount}<span className="sr-only"> likes</span>
        </button>
        <button type="button" onClick={() => setShowComments((v) => !v)} aria-expanded={showComments} className="flex items-center gap-1.5 font-lp-body text-[13px] text-app-muted hover:text-[var(--m-ink)]">
          <MessageCircle size={16} aria-hidden="true" /> {post.comments.length}<span className={post.kind === "question" ? "ml-0.5" : "sr-only"}>{post.kind === "question" ? ` ${post.comments.length === 1 ? "answer" : "answers"}` : ` ${REPLY[post.kind].noun}`}</span>
        </button>
      </footer>

      {showComments && (
        <div className="mt-3 flex flex-col gap-3">
          {post.comments.map((c) => (
            <div key={c.id} className="flex gap-2.5">
              <Link href={`/pulse/u/${c.author.id}`}><Avatar person={c.author} size="xs" /></Link>
              <div className="min-w-0 flex-1 rounded-xl bg-app-background px-3 py-2">
                <Link href={`/pulse/u/${c.author.id}`} className="font-lp-body text-[12.5px] font-semibold text-[var(--m-ink)] hover:underline">{c.author.name ?? "Capabilio member"}</Link>
                <p className="whitespace-pre-wrap break-words font-lp-body text-[13px] text-[var(--m-ink)]">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input value={draft} onChange={(e) => setDraft(e.target.value.slice(0, 1000))} onKeyDown={(e) => { if (e.key === "Enter") void sendComment(); }} placeholder={REPLY[post.kind].placeholder} aria-label={post.kind === "question" ? "Write an answer" : "Add a comment"} className="flex-1 rounded-full border border-[var(--m-rule)] bg-app-background px-4 py-2 font-lp-body text-[13px] focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20" />
            <button type="button" onClick={sendComment} disabled={sending || !draft.trim()} aria-label="Send comment" className="flex h-9 w-9 items-center justify-center rounded-full bg-app-charcoal text-white disabled:opacity-50">{sending ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}</button>
          </div>
          {error && <p role="alert" className="font-lp-body text-[12px] text-app-rose">{error}</p>}
        </div>
      )}
      {reporting && <ReportDialog targetType={reportType} targetId={post.id} onClose={() => setReporting(false)} />}
    </article>
  );
}
