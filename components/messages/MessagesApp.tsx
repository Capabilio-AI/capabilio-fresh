"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { MessageCircle } from "lucide-react";
import clsx from "clsx";
import type { ConversationItem } from "@/lib/pulse/messages";
import type { PersonSummary } from "@/lib/pulse/people";
import { ConversationList, type InboxTab } from "./ConversationList";
import { Thread } from "./Thread";
import { useMessaging } from "./MessagingProvider";

/** Inbox on the left, the open conversation on the right; one pane at a time on a phone. The open conversation lives in the URL (?c=). */
export function MessagesApp({ me, initialId, startWith }: { me: string; initialId: string | null; startWith: PersonSummary | null }) {
  const router = useRouter();
  const { refresh } = useMessaging();
  const [items, setItems] = useState<ConversationItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [activeId, setActiveId] = useState<string | null>(initialId);
  const [composeWith, setComposeWith] = useState<PersonSummary | null>(startWith);
  const [tab, setTab] = useState<InboxTab>("chats");
  const [tick, setTick] = useState(0);
  const reload = useCallback(() => {
    setTick((t) => t + 1);
    refresh();
  }, [refresh]);

  useEffect(() => {
    let live = true;
    fetch("/api/pulse/messages")
      .then((r) => (r.ok ? (r.json() as Promise<{ conversations: ConversationItem[] }>) : Promise.reject(new Error("bad"))))
      .then((d) => {
        if (!live) return;
        setItems(d.conversations);
        setFailed(false);
        setLoading(false);
      })
      .catch(() => {
        if (!live) return;
        setFailed(true);
        setLoading(false);
      });
    return () => {
      live = false;
    };
  }, [tick]);

  const open = (id: string | null) => {
    setActiveId(id);
    setComposeWith(null);
    router.replace(id ? `/pulse/messages?c=${id}` : "/pulse/messages", { scroll: false });
  };
  const hasThread = activeId !== null || composeWith !== null;
  const activeItem = items.find((c) => c.id === activeId);
  const effectiveTab: InboxTab = activeItem?.incomingRequest ? "requests" : tab;

  return (
    <div className="grid h-[calc(100vh-190px)] min-h-[480px] grid-cols-1 overflow-hidden rounded-2xl border border-app-border bg-white md:grid-cols-[340px_minmax(0,1fr)]">
      <div className={clsx("min-h-0 border-app-border md:border-r", hasThread ? "hidden md:block" : "block")}>
        {failed && <p role="alert" className="border-b border-app-border bg-app-rose-container px-4 py-2 font-lp-body text-[12px] text-app-rose">Couldn&apos;t load your conversations. <button type="button" onClick={reload} className="underline">Retry</button></p>}
        <ConversationList items={items} tab={effectiveTab} onTab={setTab} activeId={activeId} onOpen={open} loading={loading} />
      </div>
      <div className={clsx("min-h-0", hasThread ? "block" : "hidden md:block")}>
        {hasThread ? (
          <Thread key={activeId ?? `new-${composeWith?.id}`} me={me} conversationId={activeId} startWith={composeWith} onBack={() => open(null)} onChanged={reload} onStarted={(id) => { setActiveId(id); setComposeWith(null); router.replace(`/pulse/messages?c=${id}`, { scroll: false }); reload(); }} />
        ) : (
          <div className="flex h-full flex-col items-center justify-center gap-3 px-8 text-center">
            <span className="flex h-14 w-14 items-center justify-center rounded-full bg-app-orange-container text-app-orange"><MessageCircle size={22} aria-hidden="true" /></span>
            <h2 className="font-lp-display text-[17px] font-semibold text-app-charcoal">Your messages</h2>
            <p className="max-w-xs font-lp-body text-[13px] text-app-muted">Pick a conversation, or find someone with the search bar and send them a message.</p>
          </div>
        )}
      </div>
    </div>
  );
}
