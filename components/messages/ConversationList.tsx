"use client";

import { Search } from "lucide-react";
import clsx from "clsx";
import type { ConversationItem } from "@/lib/pulse/messages";
import { relativeTime } from "@/lib/pulse/format";
import { Avatar } from "@/components/pulse/Avatar";

export type InboxTab = "chats" | "requests";

export function ConversationList({ items, tab, onTab, activeId, onOpen, loading }: { items: ConversationItem[]; tab: InboxTab; onTab: (t: InboxTab) => void; activeId: string | null; onOpen: (id: string) => void; loading: boolean }) {
  const requests = items.filter((c) => c.incomingRequest);
  const chats = items.filter((c) => !c.incomingRequest && c.status !== "declined");
  const shown = tab === "requests" ? requests : chats;

  return (
    <div className="flex h-full flex-col">
      <div className="flex gap-1 border-b border-app-border px-3 pt-3" role="tablist" aria-label="Inbox">
        {([["chats", "Chats", 0], ["requests", "Requests", requests.length]] as const).map(([key, label, n]) => (
          <button key={key} type="button" role="tab" aria-selected={tab === key} onClick={() => onTab(key)} className={clsx("relative flex items-center gap-1.5 px-3 py-2.5 font-lp-body text-[13px] font-medium", tab === key ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal")}>
            {label}
            {n > 0 && <span className="rounded-full bg-app-orange px-1.5 py-0.5 font-lp-mono text-[10px] font-semibold text-white">{n}</span>}
            {tab === key && <span className="absolute inset-x-2 -bottom-px h-0.5 rounded-full bg-app-orange" />}
          </button>
        ))}
      </div>
      <ul className="flex-1 overflow-y-auto" aria-label={tab === "chats" ? "Chats" : "Message requests"}>
        {loading && shown.length === 0 && <li className="p-6 text-center font-lp-body text-[12.5px] text-app-muted">Loading…</li>}
        {!loading && shown.length === 0 && (
          <li className="flex flex-col items-center gap-2 px-6 py-12 text-center">
            <Search size={18} className="text-app-muted" aria-hidden="true" />
            <p className="font-lp-body text-[13px] font-semibold text-app-charcoal">{tab === "chats" ? "No conversations yet" : "No requests"}</p>
            <p className="font-lp-body text-[12px] text-app-muted">{tab === "chats" ? "Find someone with the search bar and send them a message." : "When someone you don't follow messages you, it shows up here for you to accept or decline."}</p>
          </li>
        )}
        {shown.map((c) => (
          <li key={c.id}>
            <button type="button" onClick={() => onOpen(c.id)} aria-current={activeId === c.id ? "true" : undefined} className={clsx("flex w-full items-center gap-3 px-4 py-3 text-left transition-colors", activeId === c.id ? "bg-app-orange-container" : "hover:bg-app-background")}>
              <Avatar person={c.other} size="md" />
              <span className="min-w-0 flex-1">
                <span className="flex items-baseline justify-between gap-2">
                  <span className={clsx("truncate font-lp-body text-[13.5px] text-app-charcoal", c.unread > 0 ? "font-bold" : "font-semibold")}>{c.other.name ?? "Capabilio member"}</span>
                  <span className="shrink-0 font-lp-mono text-[10.5px] text-app-muted">{relativeTime(c.lastMessageAt)}</span>
                </span>
                <span className="flex items-center justify-between gap-2">
                  <span className={clsx("truncate font-lp-body text-[12.5px]", c.unread > 0 ? "font-medium text-app-charcoal" : "text-app-muted")}>
                    {c.outgoingRequest ? "Request sent · " : c.lastFromMe ? "You: " : ""}{c.preview ?? "No messages yet"}
                  </span>
                  {c.unread > 0 && <span className="flex h-[18px] min-w-[18px] shrink-0 items-center justify-center rounded-full bg-app-orange px-1 font-lp-mono text-[10px] font-semibold text-white" aria-label={`${c.unread} unread`}>{c.unread}</span>}
                </span>
              </span>
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}
