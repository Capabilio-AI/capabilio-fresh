"use client";

import { useMessaging } from "./MessagingProvider";

/** Number of unread messages plus waiting requests; nothing when there are none. */
export function UnreadBadge({ className = "" }: { className?: string }) {
  const { unread, requests } = useMessaging();
  const n = unread + requests;
  if (n === 0) return null;
  return <span className={`flex min-w-[18px] items-center justify-center rounded-full bg-app-orange px-1 font-lp-mono text-[10px] font-semibold text-white ${className}`} aria-label={`${n} unread`}>{n > 99 ? "99+" : n}</span>;
}
