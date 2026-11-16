"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import clsx from "clsx";
import { BadgeCheck, ExternalLink, Flag, Heart, MessageCircle, Trash2 } from "lucide-react";
import { KIND_LABEL, MAX_COMMENT, REPORT_REASONS, agoLabel, type ReportReason } from "@/lib/professional/pulse";
import type { Post } from "@/lib/professional/pulse-server";
import { ProAvatar } from "./ProAvatar";

const REASON_LABEL: Record<ReportReason, string> = { spam: "Spam", harassment: "Harassment", misleading: "Misleading", other: "Something else" };
const MARK: Record<Post["kind"], string> = { update: "border-[var(--m-rule)]", project: "border-[var(--m-soft)]", win: "border-[var(--m-accent)]", resource: "border-[var(--m-ink)]", ask: "border-dashed border-[var(--m-ink)]" };

async function call(url: string, init: RequestInit): Promise<{ ok: boolean; json: Record<string, unknown> }> {
  try {
    const res = await fetch(url, init);
    return { ok: res.ok, json: (await res.json().catch(() => ({}))) as Record<string, unknown> };
  } catch {
    return { ok: false, json: { error: "Could not reach the server. Try again." } };
  }
}
const JSON_HEADERS = { "Content-Type": "application/json" };

/** The site a link points to, or null when the stored address cannot be read, so one bad row never breaks the feed. */
function hostOf(link: string | null): string | null {
  if (!link) return null;
  try {
    return new URL(link).hostname.replace(/^www\./, "");
  } catch {
    return null;
  }
}

/** One post: who wrote it, what it says, and what you can do with it. Likes update at once and are put back if the server refuses. */
export function PostCard({ post, now }: { post: Post; now: string }) {
  const router = useRouter();
  const [liked, setLiked] = useState(post.liked);
  const [likes, setLikes] = useState(post.likes);
  const [open, setOpen] = useState(false);
  const [comment, setComment] = useState("");
  const [note, setNote] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [reporting, setReporting] = useState(false);
  const host = hostOf(post.link);

  const like = async () => {
    const next = !liked;
    setLiked(next);
    setLikes((n) => n + (next ? 1 : -1));
    const r = await call(`/api/professional/pulse/posts/${post.id}/like`, { method: "POST" });
    if (!r.ok) {
      setLiked(!next);
      setLikes((n) => n + (next ? -1 : 1));
      setNote(String(r.json.error ?? "That did not save."));
    }
  };
  const send = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!comment.trim()) return;
    setBusy(true);
    const r = await call(`/api/professional/pulse/posts/${post.id}/comments`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ body: comment }) });
    setBusy(false);
    if (!r.ok) return setNote(String(r.json.error ?? "That did not send."));
    setComment("");
    setNote(null);
    router.refresh();
  };
  const remove = async () => {
    const r = await call(`/api/professional/pulse/posts/${post.id}`, { method: "DELETE" });
    if (!r.ok) return setNote(String(r.json.error ?? "That did not delete."));
    router.refresh();
  };
  const report = async (reason: ReportReason) => {
    const r = await call(`/api/professional/pulse/posts/${post.id}/report`, { method: "POST", headers: JSON_HEADERS, body: JSON.stringify({ reason }) });
    setReporting(false);
    setNote(r.ok ? "Thanks. We will take a look." : String(r.json.error ?? "That did not send."));
  };

  return (
    <article className={clsx("rounded-3xl border-l-4 border-y border-r bg-white p-5", MARK[post.kind], "border-y-[var(--m-rule)] border-r-[var(--m-rule)]")}>
      <header className="flex items-start gap-3">
        <ProAvatar name={post.author.name} url={post.author.avatarUrl} size={42} />
        <div className="min-w-0 flex-1">
          <p className="flex flex-wrap items-center gap-x-2 text-[14.5px] font-bold text-[var(--m-ink)]">
            {post.author.name}{post.mine && <span className="font-medium text-[var(--m-muted)]">(you)</span>}
            {post.author.verified && <span className="inline-flex items-center gap-1 text-[12px] font-bold text-[var(--m-accent-ink)]"><BadgeCheck size={13} aria-hidden />EPFO verified</span>}
          </p>
          <p className="truncate text-[13px] text-[var(--m-muted)]">{post.author.line} · {agoLabel(post.createdAt, new Date(now))}</p>
        </div>
        <span className="shrink-0 rounded-full bg-[var(--m-ground)] px-2.5 py-1 text-[11.5px] font-bold text-[var(--m-muted)]">{KIND_LABEL[post.kind]}</span>
      </header>

      {post.title && <h3 className="mt-3 font-lp-display text-[18px] font-bold leading-snug text-[var(--m-ink)]">{post.title}</h3>}
      <p className={clsx("whitespace-pre-wrap break-words text-[14.5px] leading-relaxed text-[var(--m-ink)]", post.title ? "mt-1.5" : "mt-3")}>{post.body}</p>
      {host && post.link && <a href={post.link} target="_blank" rel="noopener noreferrer" className="mt-3 flex items-center justify-between gap-3 rounded-xl border border-[var(--m-rule)] bg-[var(--m-ground)] px-4 py-3 text-[13.5px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)]"><span className="truncate">{host}</span><ExternalLink size={14} aria-hidden className="shrink-0 text-[var(--m-muted)]" /></a>}
      {post.tags.length > 0 && <ul className="mt-3 flex flex-wrap gap-2">{post.tags.map((t) => <li key={t}><Link href={`/professional/pulse?tag=${t}`} className="text-[13px] font-bold text-[var(--m-accent-ink)] hover:underline">#{t}</Link></li>)}</ul>}

      <footer className="mt-4 flex flex-wrap items-center gap-5 border-t border-[var(--m-rule)] pt-3 text-[13px]">
        <button type="button" onClick={like} aria-pressed={liked} className={clsx("inline-flex items-center gap-1.5 font-bold focus-visible:outline-2 focus-visible:outline-[var(--m-accent)]", liked ? "text-[var(--m-accent-ink)]" : "text-[var(--m-muted)] hover:text-[var(--m-ink)]")}><Heart size={16} className={liked ? "fill-current" : ""} aria-hidden />{likes}<span className="sr-only"> likes</span></button>
        <button type="button" onClick={() => setOpen((v) => !v)} aria-expanded={open} className="inline-flex items-center gap-1.5 font-bold text-[var(--m-muted)] hover:text-[var(--m-ink)] focus-visible:outline-2 focus-visible:outline-[var(--m-accent)]"><MessageCircle size={16} aria-hidden />{post.comments.length}<span className="sr-only"> comments</span></button>
        <span className="ml-auto flex items-center gap-3">
          {post.mine ? (
            confirmDelete ? <button type="button" onClick={remove} className="font-bold text-[var(--m-ink)] underline">Confirm delete</button> : <button type="button" onClick={() => setConfirmDelete(true)} aria-label="Delete this post" className="text-[var(--m-muted)] hover:text-[var(--m-ink)]"><Trash2 size={15} aria-hidden /></button>
          ) : reporting ? (
            <span className="flex flex-wrap gap-1.5" role="group" aria-label="Report this post">{REPORT_REASONS.map((r) => <button key={r} type="button" onClick={() => report(r)} className="rounded-full border border-[var(--m-rule)] px-2.5 py-1 text-[12px] font-bold text-[var(--m-ink)] hover:border-[var(--m-ink)]">{REASON_LABEL[r]}</button>)}</span>
          ) : (
            <button type="button" onClick={() => setReporting(true)} aria-label="Report this post" className="text-[var(--m-muted)] hover:text-[var(--m-ink)]"><Flag size={15} aria-hidden /></button>
          )}
        </span>
      </footer>
      <p role="status" className="empty:hidden mt-2 text-[12.5px] text-[var(--m-muted)]">{note}</p>

      {open && (
        <div className="mt-3 border-t border-[var(--m-rule)] pt-3">
          {post.comments.length > 0 && (
            <ul className="space-y-3">
              {post.comments.map((c) => (
                <li key={c.id} className="flex gap-2.5">
                  <ProAvatar name={c.author.name} url={c.author.avatarUrl} size={28} />
                  <div className="min-w-0 rounded-2xl bg-[var(--m-ground)] px-3.5 py-2"><p className="text-[12.5px] font-bold text-[var(--m-ink)]">{c.author.name}{c.mine ? " (you)" : ""} <span className="font-medium text-[var(--m-muted)]">· {agoLabel(c.createdAt, new Date(now))}</span></p><p className="whitespace-pre-wrap break-words text-[14px] text-[var(--m-ink)]">{c.body}</p></div>
                </li>
              ))}
            </ul>
          )}
          <form onSubmit={send} className="mt-3 flex gap-2">
            <label htmlFor={`c-${post.id}`} className="sr-only">Write a comment</label>
            <input id={`c-${post.id}`} value={comment} onChange={(e) => setComment(e.target.value)} maxLength={MAX_COMMENT} placeholder="Write a comment" className="min-w-0 flex-1 rounded-full border border-[var(--m-soft)] bg-white px-4 py-2 text-[14px] focus:border-[var(--m-ink)] focus:outline-none" />
            <button type="submit" disabled={busy || !comment.trim()} className="rounded-full bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-white disabled:cursor-not-allowed disabled:opacity-45">Send</button>
          </form>
        </div>
      )}
    </article>
  );
}
