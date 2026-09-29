"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CalendarCheck, Heart, Link2, UserPlus, UserCheck } from "lucide-react";

const BTN = "inline-flex items-center gap-1.5 rounded-full border border-app-border bg-white px-3 py-1.5 font-lp-body text-[12.5px] font-medium text-app-charcoal hover:bg-black/5 disabled:opacity-60";

async function post(url: string, body: unknown): Promise<{ ok: boolean; unauthenticated: boolean }> {
  const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
  return { ok: res.ok, unauthenticated: res.status === 401 };
}

export function FollowButton({ slug, following, followerCount }: { slug: string; following: boolean; followerCount: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const r = await post("/api/orgs/follow", { slug, following: !following });
    setBusy(false);
    if (r.unauthenticated) return void (window.location.href = "/login");
    if (r.ok) router.refresh();
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} className={BTN} aria-pressed={following}>
      {following ? <UserCheck size={14} /> : <UserPlus size={14} />}
      {following ? "Following" : "Follow"} · {followerCount}
    </button>
  );
}

export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const r = await post("/api/orgs/like", { postId, liked: !liked });
    setBusy(false);
    if (r.unauthenticated) return void (window.location.href = "/login");
    if (r.ok) router.refresh();
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} className={BTN} aria-pressed={liked}>
      <Heart size={14} className={liked ? "fill-app-orange text-app-orange" : ""} />
      {count}
    </button>
  );
}

export function RsvpButton({ postId, going, count }: { postId: string; going: boolean; count: number }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    const r = await post("/api/orgs/rsvp", { postId, going: !going });
    setBusy(false);
    if (r.unauthenticated) return void (window.location.href = "/login");
    if (r.ok) router.refresh();
  }
  return (
    <button type="button" onClick={toggle} disabled={busy} className={BTN} aria-pressed={going}>
      <CalendarCheck size={14} className={going ? "text-app-orange" : ""} />
      {going ? "You're going" : "I'll attend"} · {count}
    </button>
  );
}

/** Share = copy an external link (no internal repost mechanic). */
export function ShareButton({ path }: { path: string }) {
  const [copied, setCopied] = useState(false);
  async function copy() {
    try {
      await navigator.clipboard.writeText(`${window.location.origin}${path}`);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      window.prompt("Copy this link", `${window.location.origin}${path}`);
    }
  }
  return (
    <button type="button" onClick={copy} className={BTN}>
      <Link2 size={14} />
      {copied ? "Link copied" : "Share"}
    </button>
  );
}
