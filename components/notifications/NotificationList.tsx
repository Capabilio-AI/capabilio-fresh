"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Bell, Loader2 } from "lucide-react";
import type { StoredNotification } from "@/app/api/notifications/route";

const PAGE = 20;

function ago(iso: string): string {
  const s = Math.max(0, Math.round((Date.now() - new Date(iso).getTime()) / 1000));
  if (s < 60) return "just now";
  if (s < 3600) return `${Math.floor(s / 60)}m ago`;
  if (s < 86400) return `${Math.floor(s / 3600)}h ago`;
  if (s < 604800) return `${Math.floor(s / 86400)}d ago`;
  return new Date(iso).toLocaleDateString("en-IN", { dateStyle: "medium" });
}

const tellBell = () => window.dispatchEvent(new Event("notifications:changed"));

/** What has happened, newest first: unread ones stand out, clicking opens the thing and marks it read. */
export function NotificationList() {
  const router = useRouter();
  const [items, setItems] = useState<StoredNotification[] | null>(null);
  const [unread, setUnread] = useState(0);
  const [more, setMore] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  type Page = { unread: number; items: StoredNotification[] };
  const fetchPage = useCallback(async (before?: string): Promise<Page> => {
    const res = await fetch(`/api/notifications?limit=${PAGE}${before ? `&before=${encodeURIComponent(before)}` : ""}`, { cache: "no-store" });
    if (!res.ok) throw new Error("load failed");
    return (await res.json()) as Page;
  }, []);
  const show = useCallback((page: Page, append: boolean) => {
    setError(null);
    setUnread(page.unread);
    setMore(page.items.length === PAGE);
    setItems((prev) => (append && prev ? [...prev, ...page.items] : page.items));
  }, []);
  const fail = useCallback(() => {
    setError("Couldn't load your notifications. Check your connection and try again.");
    setItems((prev) => prev ?? []);
  }, []);

  useEffect(() => {
    let live = true;
    fetchPage()
      .then((page) => live && show(page, false))
      .catch(() => live && fail());
    return () => {
      live = false;
    };
  }, [fetchPage, show, fail]);

  async function markRead(ids: string[] | "all") {
    try {
      const res = await fetch("/api/notifications/read", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(ids === "all" ? { all: true } : { ids }) });
      if (!res.ok) return false;
      setItems((prev) => prev?.map((n) => (ids === "all" || ids.includes(n.id) ? { ...n, read: true } : n)) ?? prev);
      setUnread((u) => (ids === "all" ? 0 : Math.max(0, u - ids.length)));
      tellBell();
      return true;
    } catch {
      return false;
    }
  }

  async function open(n: StoredNotification) {
    if (!n.read) await markRead([n.id]);
    if (n.href) router.push(n.href);
  }

  async function loadMore() {
    if (!items?.length) return;
    setBusy(true);
    try {
      show(await fetchPage(items[items.length - 1].createdAt), true);
    } catch {
      fail();
    }
    setBusy(false);
  }

  if (items === null) return <p className="py-8 text-center text-[13px] text-app-muted">Loading…</p>;
  return (
    <section aria-label="Notifications">
      <div className="flex items-center justify-between">
        <h2 className="text-[15px] font-bold text-app-charcoal">Activity {unread > 0 && <span className="ml-1 text-[12px] font-semibold text-app-orange">{unread} new</span>}</h2>
        {unread > 0 && (
          <button type="button" className="text-[12.5px] font-semibold text-app-blue hover:underline" onClick={() => markRead("all")}>
            Mark all as read
          </button>
        )}
      </div>
      {error && (
        <p role="alert" className="mt-3 text-[12.5px] text-app-rose">
          {error}
        </p>
      )}
      {items.length === 0 && !error ? (
        <div className="mt-3 flex flex-col items-center gap-2 rounded-xl border border-dashed border-app-border px-6 py-10 text-center">
          <Bell size={20} className="text-app-muted" aria-hidden="true" />
          <p className="text-[13.5px] font-medium text-app-charcoal">No activity yet</p>
          <p className="text-[12.5px] text-app-muted">When something happens on your account, it shows up here.</p>
        </div>
      ) : (
        <ul className="mt-3 flex flex-col gap-2">
          {items.map((n) => (
            <li key={n.id}>
              <button
                type="button"
                onClick={() => open(n)}
                className={`flex w-full items-start gap-3 rounded-xl border p-4 text-left transition-colors hover:bg-app-background ${n.read ? "border-app-border bg-[#fff]" : "border-app-orange/30 bg-app-orange/5"}`}
              >
                <span aria-hidden="true" className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.read ? "bg-transparent" : "bg-app-orange"}`} />
                <span className="min-w-0 flex-1">
                  <span className={`block text-[13.5px] text-app-charcoal ${n.read ? "font-medium" : "font-bold"}`}>{n.title}</span>
                  {n.body && <span className="mt-0.5 block text-[12.5px] text-app-muted">{n.body}</span>}
                  <span className="mt-1 block text-[11.5px] text-app-muted">{ago(n.createdAt)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
      {more && (
        <div className="mt-3 text-center">
          <button type="button" className="text-[12.5px] font-semibold text-app-blue hover:underline" onClick={loadMore} disabled={busy}>
            {busy ? <Loader2 size={14} className="inline animate-spin" aria-hidden="true" /> : "Load older"}
          </button>
        </div>
      )}
    </section>
  );
}
