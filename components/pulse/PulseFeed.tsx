"use client";

import { useEffect, useState } from "react";
import { Award, Heart, HelpCircle, Loader2, MessageCircle, Send, Sparkles } from "lucide-react";
import type { PulseComment, PulsePost } from "@/lib/pulse/data";

const POST_TYPES = [
  { key: "post", label: "Post", icon: Send, prefix: "" },
  { key: "project", label: "Project", icon: Sparkles, prefix: "[Project] " },
  { key: "question", label: "Question", icon: HelpCircle, prefix: "[Question] " },
  { key: "achievement", label: "Achievement", icon: Award, prefix: "[Achievement] " },
] as const;
type PostTypeKey = (typeof POST_TYPES)[number]["key"];

function initialsOf(name: string | null): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() ?? "?";
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const minutes = Math.floor(diffMs / 60_000);
  if (minutes < 1) return "just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

const AVATAR =
  "flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-lp-accent-indigo to-lp-accent-ochre font-lp-display text-lp-label-sm font-semibold text-lp-surface-card";

export function PulseFeed() {
  const [posts, setPosts] = useState<PulsePost[] | null>(null);
  const [draft, setDraft] = useState("");
  const [postType, setPostType] = useState<PostTypeKey>("post");
  const [posting, setPosting] = useState(false);

  useEffect(() => {
    fetch("/api/pulse/posts")
      .then((res) => res.json())
      .then((data) => setPosts(data.posts ?? []));
  }, []);

  async function submitPost() {
    if (draft.trim().length === 0) return;
    setPosting(true);
    const prefix = POST_TYPES.find((t) => t.key === postType)?.prefix ?? "";
    const res = await fetch("/api/pulse/posts", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: `${prefix}${draft.trim()}` }),
    });
    setPosting(false);
    if (!res.ok) return;
    const data = await res.json();
    setPosts(data.posts);
    setDraft("");
    setPostType("post");
  }

  function toggleLike(postId: string) {
    setPosts((prev) =>
      (prev ?? []).map((p) =>
        p.id === postId
          ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
          : p
      )
    );
    fetch(`/api/pulse/posts/${postId}/like`, { method: "POST" }).then((res) => {
      if (res.ok) return;
      setPosts((prev) =>
        (prev ?? []).map((p) =>
          p.id === postId
            ? { ...p, likedByMe: !p.likedByMe, likeCount: p.likeCount + (p.likedByMe ? -1 : 1) }
            : p
        )
      );
    });
  }

  function addComment(postId: string, comment: PulseComment) {
    setPosts((prev) =>
      (prev ?? []).map((p) => (p.id === postId ? { ...p, comments: [...p.comments, comment] } : p))
    );
  }

  return (
    <div className="mx-auto flex w-full max-w-2xl flex-col gap-5">
      <div className="rounded-xl border border-lp-border-hairline bg-lp-surface-card p-5 shadow-sm">
        <p className="mb-2 font-lp-body text-lp-body-sm font-medium text-lp-text-ink">What are you building?</p>
        <div className="mb-3 flex flex-wrap gap-1.5">
          {POST_TYPES.map((t) => {
            const TypeIcon = t.icon;
            const selected = postType === t.key;
            return (
              <button
                key={t.key}
                type="button"
                onClick={() => setPostType(t.key)}
                className={`flex items-center gap-1.5 rounded-full border px-3 py-1 font-lp-mono text-lp-label-sm font-medium transition-colors ${
                  selected
                    ? "border-app-orange bg-app-orange-container text-app-orange"
                    : "border-lp-border-hairline text-lp-text-muted hover:text-lp-text-ink"
                }`}
              >
                <TypeIcon size={12} />
                {t.label}
              </button>
            );
          })}
        </div>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Share something with your peers…"
          rows={3}
          className="w-full resize-none rounded-lg border border-lp-border-hairline bg-lp-surface px-4 py-3 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
        />
        <div className="mt-3 flex justify-end">
          <button
            type="button"
            onClick={submitPost}
            disabled={posting || draft.trim().length === 0}
            className="flex items-center gap-2 rounded-lg bg-lp-text-ink px-4 py-2 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card shadow-sm transition-transform hover:scale-105 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Post
            <Send size={14} />
          </button>
        </div>
      </div>

      {posts === null ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-lp-accent-indigo" />
        </div>
      ) : posts.length === 0 ? (
        <div className="rounded-xl border border-dashed border-lp-border-strong bg-lp-surface-subtle/50 px-6 py-12 text-center">
          <p className="font-lp-body text-lp-body-sm text-lp-text-muted">
            No posts yet — be the first to share something.
          </p>
        </div>
      ) : (
        posts.map((post) => (
          <PostCard key={post.id} post={post} onToggleLike={() => toggleLike(post.id)} onComment={(c) => addComment(post.id, c)} />
        ))
      )}
    </div>
  );
}

function PostCard({
  post,
  onToggleLike,
  onComment,
}: {
  post: PulsePost;
  onToggleLike: () => void;
  onComment: (comment: PulseComment) => void;
}) {
  const [showComments, setShowComments] = useState(false);
  const [commentDraft, setCommentDraft] = useState("");
  const [sending, setSending] = useState(false);

  async function submitComment() {
    if (commentDraft.trim().length === 0) return;
    setSending(true);
    const res = await fetch(`/api/pulse/posts/${post.id}/comments`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: commentDraft.trim() }),
    });
    setSending(false);
    if (!res.ok) return;
    const { comment } = await res.json();
    onComment(comment);
    setCommentDraft("");
  }

  return (
    <div className="rounded-xl border border-lp-border-hairline bg-lp-surface-card p-5 shadow-sm">
      <div className="flex items-center gap-3">
        <span className={AVATAR}>{initialsOf(post.author.name)}</span>
        <div>
          <p className="font-lp-body text-lp-body-sm font-semibold text-lp-text-ink">
            {post.author.name ?? "Student"}
          </p>
          <p className="font-lp-mono text-lp-label-sm text-lp-text-muted">{relativeTime(post.createdAt)}</p>
        </div>
      </div>
      <p className="mt-3 whitespace-pre-wrap font-lp-body text-lp-body-sm leading-relaxed text-lp-text-ink">
        {post.content}
      </p>
      <div className="mt-4 flex items-center gap-4 border-t border-lp-border-hairline pt-3">
        <button
          type="button"
          onClick={onToggleLike}
          className={`flex items-center gap-1.5 font-lp-body text-lp-body-sm font-medium transition-colors ${
            post.likedByMe ? "text-lp-error" : "text-lp-text-muted hover:text-lp-text-ink"
          }`}
        >
          <Heart size={16} fill={post.likedByMe ? "currentColor" : "none"} />
          {post.likeCount > 0 ? post.likeCount : "Like"}
        </button>
        <button
          type="button"
          onClick={() => setShowComments((v) => !v)}
          className="flex items-center gap-1.5 font-lp-body text-lp-body-sm font-medium text-lp-text-muted transition-colors hover:text-lp-text-ink"
        >
          <MessageCircle size={16} />
          {post.comments.length > 0 ? post.comments.length : "Comment"}
        </button>
      </div>

      {showComments && (
        <div className="mt-3 flex flex-col gap-3 border-t border-lp-border-hairline pt-3">
          {post.comments.map((c) => (
            <div key={c.id} className="flex items-start gap-2.5">
              <span className={`${AVATAR} h-8 w-8 text-[11px]`}>{initialsOf(c.author.name)}</span>
              <div className="rounded-lg bg-lp-surface-subtle px-3 py-2">
                <p className="font-lp-body text-lp-label-sm font-semibold text-lp-text-ink">
                  {c.author.name ?? "Student"}
                </p>
                <p className="font-lp-body text-lp-body-sm text-lp-text-ink">{c.content}</p>
              </div>
            </div>
          ))}
          <div className="flex items-center gap-2">
            <input
              value={commentDraft}
              onChange={(e) => setCommentDraft(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && submitComment()}
              placeholder="Write a comment…"
              className="flex-1 rounded-full border border-lp-border-hairline bg-lp-surface px-4 py-2 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
            />
            <button
              type="button"
              onClick={submitComment}
              disabled={sending || commentDraft.trim().length === 0}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-lp-accent-indigo text-lp-surface-card disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Send size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
