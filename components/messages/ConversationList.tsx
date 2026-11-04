"use client";

import { useEffect, useState } from "react";
import { Loader2, Search, X } from "lucide-react";
import clsx from "clsx";
import type { ConversationItem } from "@/lib/pulse/messages";
import { relativeTime } from "@/lib/pulse/format";
import { Avatar } from "@/components/pulse/Avatar";
import type { PersonSummary } from "@/lib/pulse/people";
import type { SearchResults } from "@/lib/pulse/search";

export type InboxTab = "chats" | "requests";

const MIN_SEARCH = 2;
const DEBOUNCE_MS = 250;

/** The search box above the inbox: find any person, and open a chat with them at once (their existing conversation, or a new one). */
function PeopleSearch({ items, onOpen, onPickPerson }: { items: ConversationItem[]; onOpen: (id: string) => void; onPickPerson: (person: PersonSummary) => void }) {
  const [term, setTerm] = useState("");
  const [people, setPeople] = useState<SearchResults["people"]>([]);
  const [loading, setLoading] = useState(false);
  const [failed, setFailed] = useState(false);
  const q = term.trim();
  const active = q.length >= MIN_SEARCH;

  useEffect(() => {
    if (!active) return;
    const controller = new AbortController();
    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
        if (!res.ok) throw new Error("bad");
        setPeople(((await res.json()) as SearchResults).people);
        setFailed(false);
      } catch (e) {
        if ((e as Error).name !== "AbortError") setFailed(true);
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);
    return () => { clearTimeout(timer); controller.abort(); };
  }, [q, active]);

  const pick = (person: PersonSummary) => {
    const existing = items.find((c) => c.other.id === person.id);
    setTerm("");
    if (existing) onOpen(existing.id);
    else onPickPerson(person);
  };

  return (
    <div className="border-b border-app-border px-3 py-3">
      <label className="relative block">
        <span className="sr-only">Find someone to message</span>
        <Search size={15} aria-hidden className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-app-muted" />
        <input value={term} onChange={(e) => setTerm(e.target.value)} placeholder="Search people to message" autoComplete="off" className="w-full rounded-full border border-app-border bg-app-background py-2 pl-9 pr-9 font-lp-body text-[13px] text-app-charcoal outline-none placeholder:text-app-muted focus:border-app-charcoal" />
        {term && <button type="button" onClick={() => setTerm("")} aria-label="Clear search" className="absolute right-2.5 top-1/2 -translate-y-1/2 rounded-full p-1 text-app-muted hover:bg-app-border"><X size={13} aria-hidden /></button>}
      </label>
      {active && (
        <ul role="listbox" aria-label="People" className="mt-2 max-h-72 overflow-y-auto">
          {loading && people.length === 0 && <li className="flex items-center gap-2 px-2 py-3 font-lp-body text-[12.5px] text-app-muted"><Loader2 size={13} className="animate-spin" aria-hidden />Searching…</li>}
          {failed && <li role="alert" className="px-2 py-3 font-lp-body text-[12.5px] text-app-rose">Couldn&apos;t search just now. Try again.</li>}
          {!loading && !failed && people.length === 0 && <li className="px-2 py-3 font-lp-body text-[12.5px] text-app-muted">No one found for &ldquo;{q}&rdquo;.</li>}
          {people.map((p) => (
            <li key={p.id} role="option" aria-selected={false}>
              <button type="button" onClick={() => pick(p)} className="flex w-full items-center gap-3 rounded-xl px-2 py-2 text-left transition-colors hover:bg-app-background">
                <Avatar person={p} size="md" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-lp-body text-[13.5px] font-semibold text-app-charcoal">{p.name ?? "Capabilio member"}</span>
                  <span className="block truncate font-lp-body text-[12px] text-app-muted">{p.headline ?? p.tagline ?? "Capabilio member"}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function ConversationList({ items, tab, onTab, activeId, onOpen, onPickPerson, loading }: { items: ConversationItem[]; tab: InboxTab; onTab: (t: InboxTab) => void; activeId: string | null; onOpen: (id: string) => void; onPickPerson: (person: PersonSummary) => void; loading: boolean }) {
  const requests = items.filter((c) => c.incomingRequest);
  const chats = items.filter((c) => !c.incomingRequest && c.status !== "declined");
  const shown = tab === "requests" ? requests : chats;

  return (
    <div className="flex h-full flex-col">
      <PeopleSearch items={items} onOpen={onOpen} onPickPerson={onPickPerson} />
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
