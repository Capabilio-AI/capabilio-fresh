"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Heart, UserCheck, UserPlus } from "lucide-react";

async function send(url: string, body: unknown): Promise<"ok" | "signin" | "error"> {
  try {
    const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    if (res.status === 401) return "signin";
    return res.ok ? "ok" : "error";
  } catch {
    return "error";
  }
}

const FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--co)]";

/** Follow or unfollow. Signed-out visitors are sent to sign in. The count updates optimistically and reverts if the save fails. */
export function FollowButton({ slug, following, followerCount }: { slug: string; following: boolean; followerCount: number }) {
  const router = useRouter();
  const [state, setState] = useState({ following, count: followerCount });
  const [busy, setBusy] = useState(false);
  const [failed, setFailed] = useState(false);

  async function toggle() {
    const next = !state.following;
    setBusy(true);
    setFailed(false);
    setState({ following: next, count: state.count + (next ? 1 : -1) });
    const result = await send("/api/orgs/follow", { slug, following: next });
    setBusy(false);
    if (result === "signin") {
      setState({ following, count: followerCount });
      router.push("/login");
      return;
    }
    if (result === "error") {
      setState({ following: !next, count: state.count });
      return setFailed(true);
    }
    router.refresh();
  }

  return (
    <span className="inline-flex flex-col items-start gap-1">
      <button
        type="button"
        onClick={toggle}
        disabled={busy}
        aria-pressed={state.following}
        className={`inline-flex h-10 items-center gap-2 rounded-full px-5 font-cap-body text-[14px] font-semibold transition-[background-color,transform,box-shadow] duration-150 active:scale-[0.98] disabled:opacity-60 motion-reduce:transition-none ${FOCUS} ${
          state.following ? "border border-[#d9dbe5] bg-white text-[#0c1020] hover:bg-[#f3f4fa]" : "bg-[var(--co)] text-[var(--co-ink)] hover:brightness-110"
        }`}
      >
        {state.following ? <UserCheck size={16} aria-hidden /> : <UserPlus size={16} aria-hidden />}
        {state.following ? "Following" : "Follow"}
        <span className="tabular-nums opacity-80">{state.count.toLocaleString("en-IN")}</span>
      </button>
      {failed && <span role="alert" className="font-cap-body text-[12px] text-[#a5560a]">Could not save. Try again.</span>}
    </span>
  );
}

/** Like or unlike a post, same optimistic pattern. */
export function LikeButton({ postId, liked, count }: { postId: string; liked: boolean; count: number }) {
  const router = useRouter();
  const [state, setState] = useState({ liked, count });
  const [busy, setBusy] = useState(false);

  async function toggle() {
    const next = !state.liked;
    setBusy(true);
    setState({ liked: next, count: state.count + (next ? 1 : -1) });
    const result = await send("/api/orgs/like", { postId, liked: next });
    setBusy(false);
    if (result === "signin") return router.push("/login");
    if (result === "error") return setState({ liked: !next, count: state.count });
    router.refresh();
  }

  return (
    <button
      type="button"
      onClick={toggle}
      disabled={busy}
      aria-pressed={state.liked}
      aria-label={state.liked ? "Unlike this update" : "Like this update"}
      className={`inline-flex h-8 items-center gap-1.5 rounded-full border border-[#e3e5ee] bg-white px-3 font-cap-body text-[13px] font-medium text-[#555a70] transition-colors hover:bg-[#f3f4fa] disabled:opacity-60 motion-reduce:transition-none ${FOCUS}`}
    >
      <Heart size={14} aria-hidden className={state.liked ? "fill-[var(--co)] text-[var(--co)]" : ""} />
      <span className="tabular-nums">{state.count}</span>
    </button>
  );
}
