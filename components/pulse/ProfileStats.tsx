"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Loader2, X } from "lucide-react";
import type { Connection, ConnectionType } from "@/lib/pulse/connections";
import { Avatar } from "./Avatar";
import { FollowButton } from "./FollowButton";
import { MentorBadge } from "./MentorBadge";

const TITLE: Record<ConnectionType, string> = { followers: "Followers", following: "Following" };

function ConnectionsDialog({ userId, type, name, onClose }: { userId: string; type: ConnectionType; name: string; onClose: () => void }) {
  const router = useRouter();
  const closeRef = useRef<HTMLButtonElement>(null);
  const [state, setState] = useState<{ people: Connection[]; total: number } | "loading" | "failed">("loading");

  useEffect(() => {
    let live = true;
    fetch(`/api/pulse/connections/${userId}?type=${type}`)
      .then((r) => (r.ok ? r.json() : Promise.reject(new Error("bad"))))
      .then((d: { people: Connection[]; total: number }) => live && setState(d))
      .catch(() => live && setState("failed"));
    return () => { live = false; };
  }, [userId, type]);

  useEffect(() => {
    closeRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    document.addEventListener("keydown", onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => { document.removeEventListener("keydown", onKey); document.body.style.overflow = prev; };
  }, [onClose]);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onMouseDown={(e) => e.target === e.currentTarget && onClose()}>
      <div role="dialog" aria-modal="true" aria-label={`${TITLE[type]} of ${name}`} className="flex max-h-[80vh] w-full max-w-md flex-col overflow-hidden rounded-2xl bg-white shadow-2xl">
        <header className="flex items-center justify-between border-b border-[var(--m-rule)] px-5 py-4">
          <h2 className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">{TITLE[type]}{typeof state === "object" ? ` · ${state.total}` : ""}</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="Close" className="rounded-lg p-1.5 text-[var(--m-muted)] hover:bg-[var(--m-ground)]"><X size={18} aria-hidden /></button>
        </header>
        <div className="min-h-0 flex-1 overflow-y-auto px-5 py-3">
          {state === "loading" && <p className="flex items-center justify-center gap-2 py-10 text-[13px] text-app-muted"><Loader2 size={15} className="animate-spin" aria-hidden />Loading…</p>}
          {state === "failed" && <p role="alert" className="py-10 text-center text-[13px] text-app-rose">Couldn&apos;t load this list. Close it and try again.</p>}
          {typeof state === "object" && state.people.length === 0 && <p className="py-10 text-center text-[13.5px] text-app-muted">{type === "followers" ? `${name} has no followers yet.` : `${name} isn't following anyone yet.`}</p>}
          {typeof state === "object" && state.people.length > 0 && (
            <ul className="flex flex-col gap-4 py-1">
              {state.people.map((p) => (
                <li key={p.id} className="flex items-center gap-3">
                  <Link href={`/pulse/u/${p.id}`} onClick={onClose}><Avatar person={p} size="sm" /></Link>
                  <div className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-1.5"><Link href={`/pulse/u/${p.id}`} onClick={onClose} className="truncate font-lp-body text-[13.5px] font-semibold text-[var(--m-ink)] hover:underline">{p.name ?? "Capabilio member"}</Link>{p.isMentor && <MentorBadge />}</span>
                    {p.tagline && <p className="truncate font-lp-body text-[12px] font-medium text-app-blue">{p.tagline}</p>}
                    <p className="truncate font-lp-body text-[11.5px] text-app-muted">{p.headline ?? "Capabilio member"}</p>
                  </div>
                  {!p.isMe && <FollowButton userId={p.id} initialFollowing={p.following} compact onChange={() => router.refresh()} />}
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </div>
  );
}

/** Posts, Followers and Following. The last two open the live list; counts re-read from the server after any follow change. */
export function ProfileStats({ userId, name, counts, inline = false }: { userId: string; name: string; counts: { posts: number; followers: number; following: number }; inline?: boolean }) {
  const [open, setOpen] = useState<ConnectionType | null>(null);
  const tile = "font-lp-display text-[16px] font-bold text-[var(--m-ink)]";
  const label = "font-lp-body text-[10.5px] text-app-muted";
  return (
    <>
      <dl className={inline ? "mt-4 flex gap-6" : "mt-4 grid grid-cols-3 gap-1 border-t border-[var(--m-rule)] pt-4 text-center"}>
        <div><dd className={tile}>{counts.posts}</dd><dt className={label}>Posts</dt></div>
        {(["followers", "following"] as const).map((t) => (
          <div key={t}>
            <button type="button" onClick={() => setOpen(t)} aria-haspopup="dialog" className="w-full rounded-lg py-0.5 transition-colors hover:bg-app-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-orange/40">
              <span className={`block ${tile}`}>{counts[t]}</span><span className={`block ${label}`}>{TITLE[t]}</span>
            </button>
          </div>
        ))}
      </dl>
      {open && <ConnectionsDialog userId={userId} type={open} name={name} onClose={() => setOpen(null)} />}
    </>
  );
}
