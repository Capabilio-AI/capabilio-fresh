"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { ArrowLeft, Ban, Check, Flag, Loader2, Phone, PhoneMissed, Send, Trash2, Video } from "lucide-react";
import clsx from "clsx";
import type { ConversationItem, MessageItem, Thread as ThreadData } from "@/lib/pulse/messages";
import type { PersonSummary } from "@/lib/pulse/people";
import { Avatar } from "@/components/pulse/Avatar";
import { ReportDialog } from "@/components/pulse/ReportDialog";
import { useCall } from "./CallProvider";
import { useMessaging } from "./MessagingProvider";

const MAX = 2000;
const dayLabel = (iso: string) => {
  const d = new Date(iso);
  const days = Math.floor((new Date().setHours(0, 0, 0, 0) - new Date(d).setHours(0, 0, 0, 0)) / 86_400_000);
  return days === 0 ? "Today" : days === 1 ? "Yesterday" : d.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric" });
};
const clock = (iso: string) => new Date(iso).toLocaleTimeString("en-IN", { hour: "numeric", minute: "2-digit" });

interface Props {
  me: string;
  /** an open conversation, or a person to start one with */
  conversationId: string | null;
  startWith: PersonSummary | null;
  onBack: () => void;
  onChanged: () => void;
  onStarted: (conversationId: string) => void;
}

export function Thread({ me, conversationId, startWith, onBack, onChanged, onStarted }: Props) {
  const { subscribe } = useMessaging();
  const call = useCall();
  const [data, setData] = useState<ThreadData | null>(null);
  const [messages, setMessages] = useState<MessageItem[]>([]);
  const [otherReadAt, setOtherReadAt] = useState<string | null>(null);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [loadFailed, setLoadFailed] = useState(false);
  const [reporting, setReporting] = useState<{ type: "user" | "message"; id: string } | null>(null);
  const bottom = useRef<HTMLDivElement>(null);
  const openId = useRef<string | null>(conversationId);

  const conversation: ConversationItem | null = data?.conversation ?? null;
  const other: PersonSummary | null = conversation?.other ?? startWith;

  const markRead = useCallback((id: string) => {
    void fetch(`/api/pulse/messages/${id}/read`, { method: "POST" }).then(() => onChanged());
  }, [onChanged]);

  useEffect(() => {
    openId.current = conversationId;
    if (!conversationId) return;
    let live = true;
    fetch(`/api/pulse/messages/${conversationId}`)
      .then((r) => (r.ok ? (r.json() as Promise<ThreadData>) : Promise.reject(new Error("bad"))))
      .then((t) => {
        if (!live) return;
        setData(t);
        setMessages(t.messages);
        setOtherReadAt(t.otherReadAt);
        setLoadFailed(false);
        markRead(conversationId);
      })
      .catch(() => live && setLoadFailed(true));
    return () => {
      live = false;
    };
  }, [conversationId, markRead]);

  useEffect(() => {
    return subscribe((event, payload) => {
      if (payload.conversationId !== openId.current) return;
      if (event === "message") {
        const m = payload.message as MessageItem;
        setMessages((cur) => (cur.some((x) => x.id === m.id) ? cur : [...cur, m]));
        if (m.senderId !== me && openId.current) markRead(openId.current);
      }
      if (event === "read" && payload.userId !== me) setOtherReadAt(payload.at as string);
      if (event === "deleted") setMessages((cur) => cur.map((m) => (m.id === payload.messageId ? { ...m, body: "", deleted: true } : m)));
      if (event === "conversation") {
        onChanged();
        void fetch(`/api/pulse/messages/${openId.current}`).then((r) => (r.ok ? r.json() : null)).then((t: ThreadData | null) => t && setData(t));
      }
    });
  }, [subscribe, me, markRead, onChanged]);

  useEffect(() => {
    bottom.current?.scrollIntoView({ behavior: "smooth", block: "end" });
  }, [messages.length]);

  async function send() {
    const body = draft.trim();
    if (!body || !other) return;
    setSending(true);
    setError(null);
    try {
      const res = await fetch("/api/pulse/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ userId: other.id, body }) });
      const json = (await res.json().catch(() => null)) as { error?: string; conversationId?: string; message?: MessageItem } | null;
      if (!res.ok || !json?.message) return setError(json?.error ?? "Couldn't send. Try again.");
      setDraft("");
      setMessages((cur) => (cur.some((x) => x.id === json.message!.id) ? cur : [...cur, json.message!]));
      if (!conversationId && json.conversationId) onStarted(json.conversationId);
      else onChanged();
    } catch {
      setError("Couldn't reach the server. Check your connection.");
    } finally {
      setSending(false);
    }
  }

  async function respond(action: "accept" | "decline") {
    if (!conversationId) return;
    const res = await fetch(`/api/pulse/messages/${conversationId}/respond`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action }) });
    if (!res.ok) return setError("Couldn't update the request.");
    onChanged();
    if (action === "decline") onBack();
  }
  async function block() {
    if (!other) return;
    const res = await fetch(`/api/pulse/block/${other.id}`, { method: "POST" });
    if (!res.ok) return setError("Couldn't block. Try again.");
    onChanged();
    onBack();
  }
  async function remove(id: string) {
    const res = await fetch(`/api/pulse/messages/message/${id}`, { method: "DELETE" });
    if (res.ok) setMessages((cur) => cur.map((m) => (m.id === id ? { ...m, body: "", deleted: true } : m)));
  }

  if (!other) return <div className="flex h-full items-center justify-center p-8 text-center font-lp-body text-[13px] text-app-muted">{loadFailed ? "Couldn't open this conversation." : "Loading…"}</div>;

  const mineCount = messages.filter((m) => m.senderId === me).length;
  const canSend = !conversation || conversation.status === "accepted" || (conversation.outgoingRequest && mineCount < 1) || (conversation.status === "declined" && !conversation.requestedByMe);
  const lastMineId = [...messages].reverse().find((m) => m.senderId === me && !m.deleted && m.kind === "text")?.id;

  return (
    <div className="flex h-full flex-col">
      <header className="flex items-center gap-3 border-b border-app-border px-4 py-3">
        <button type="button" onClick={onBack} aria-label="Back to conversations" className="rounded-full p-1.5 text-app-muted hover:bg-app-background md:hidden"><ArrowLeft size={17} /></button>
        <Link href={`/pulse/u/${other.id}`}><Avatar person={other} size="sm" /></Link>
        <div className="min-w-0 flex-1">
          <Link href={`/pulse/u/${other.id}`} className="block truncate font-lp-body text-[14px] font-semibold text-app-charcoal hover:underline">{other.name ?? "Capabilio member"}</Link>
          <p className="truncate font-lp-body text-[11.5px] text-app-muted">{other.headline ?? ""}</p>
        </div>
        {conversation?.status === "accepted" && call.supported && (
          <>
            <button type="button" onClick={() => void call.startCall(other, "voice")} disabled={call.state.phase !== "idle"} aria-label={`Voice call ${other.name ?? ""}`.trim()} title={call.state.phase !== "idle" ? "You're on a call" : "Voice call"} className="rounded-full p-2 text-app-charcoal hover:bg-app-background disabled:opacity-40"><Phone size={16} /></button>
            <button type="button" onClick={() => void call.startCall(other, "video")} disabled={call.state.phase !== "idle"} aria-label={`Video call ${other.name ?? ""}`.trim()} title={call.state.phase !== "idle" ? "You're on a call" : "Video call"} className="rounded-full p-2 text-app-charcoal hover:bg-app-background disabled:opacity-40"><Video size={16} /></button>
          </>
        )}
        {conversation && <button type="button" onClick={() => setReporting({ type: "user", id: other.id })} aria-label="Report this person" className="rounded-full p-2 text-app-muted hover:bg-app-background"><Flag size={15} /></button>}
      </header>

      <div className="flex-1 overflow-y-auto px-4 py-4" aria-live="polite">
        {messages.length === 0 && <p className="mx-auto max-w-xs py-10 text-center font-lp-body text-[12.5px] text-app-muted">{conversation ? "No messages yet." : `Say hello to ${other.name?.split(" ")[0] ?? "them"}. If they don't follow you yet, this is sent as a message request.`}</p>}
        <ul className="flex flex-col gap-1.5">
          {messages.map((m, i) => {
            const mine = m.senderId === me;
            const day = dayLabel(m.createdAt);
            const header = i === 0 || dayLabel(messages[i - 1].createdAt) !== day;
            if (m.kind === "call") {
              const missed = /^(Missed|Declined)/.test(m.body);
              return (
                <li key={m.id}>
                  {header && <p className="my-3 text-center font-lp-mono text-[10.5px] text-app-muted">{day}</p>}
                  <p className={clsx("mx-auto flex w-fit items-center gap-1.5 rounded-full border border-app-border bg-app-background px-3 py-1 font-lp-body text-[12px]", missed ? "text-app-rose" : "text-app-muted")}>
                    {missed ? <PhoneMissed size={12} aria-hidden="true" /> : /^Video/.test(m.body) ? <Video size={12} aria-hidden="true" /> : <Phone size={12} aria-hidden="true" />} {m.body} <span className="font-lp-mono text-[10px]">{clock(m.createdAt)}</span>
                  </p>
                </li>
              );
            }
            return (
              <li key={m.id}>
                {header && <p className="my-3 text-center font-lp-mono text-[10.5px] text-app-muted">{day}</p>}
                <div className={clsx("group flex items-end gap-1.5", mine ? "justify-end" : "justify-start")}>
                  {mine && !m.deleted && <button type="button" onClick={() => remove(m.id)} aria-label="Delete message" className="rounded-full p-1.5 text-app-muted opacity-0 hover:bg-app-background focus:opacity-100 group-hover:opacity-100"><Trash2 size={13} /></button>}
                  <div className={clsx("max-w-[78%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2 font-lp-body text-[13.5px] leading-relaxed", m.deleted ? "border border-dashed border-app-border italic text-app-muted" : mine ? "bg-app-charcoal text-white" : "border border-app-border bg-white text-app-charcoal")}>
                    {m.deleted ? "Message deleted" : m.body}
                    <span className={clsx("ml-2 inline-block align-bottom font-lp-mono text-[9.5px]", mine && !m.deleted ? "text-white/60" : "text-app-muted")}>{clock(m.createdAt)}</span>
                  </div>
                  {!mine && !m.deleted && <button type="button" onClick={() => setReporting({ type: "message", id: m.id })} aria-label="Report message" className="rounded-full p-1.5 text-app-muted opacity-0 hover:bg-app-background focus:opacity-100 group-hover:opacity-100"><Flag size={12} /></button>}
                </div>
                {m.id === lastMineId && otherReadAt && otherReadAt >= m.createdAt && <p className="mt-0.5 flex items-center justify-end gap-1 font-lp-mono text-[10px] text-app-muted"><Check size={10} aria-hidden="true" /> Seen</p>}
              </li>
            );
          })}
        </ul>
        <div ref={bottom} />
      </div>

      {conversation?.incomingRequest ? (
        <div className="border-t border-app-border bg-app-orange-container p-4">
          <p className="font-lp-body text-[13px] text-app-charcoal"><span className="font-semibold">{other.name ?? "This person"}</span> wants to message you. They can&apos;t see when you read it until you accept.</p>
          <div className="mt-3 flex flex-wrap gap-2">
            <button type="button" onClick={() => respond("accept")} className="rounded-full bg-app-charcoal px-4 py-2 font-lp-body text-[13px] font-semibold text-white">Accept</button>
            <button type="button" onClick={() => respond("decline")} className="rounded-full border border-app-border bg-white px-4 py-2 font-lp-body text-[13px] font-semibold text-app-charcoal">Decline</button>
            <button type="button" onClick={block} className="flex items-center gap-1.5 rounded-full px-4 py-2 font-lp-body text-[13px] font-semibold text-app-rose hover:bg-white"><Ban size={13} aria-hidden="true" /> Block</button>
          </div>
        </div>
      ) : (
        <div className="border-t border-app-border p-3">
          {conversation?.outgoingRequest && <p className="mb-2 px-1 font-lp-body text-[12px] text-app-muted">Request sent. You can send more once {other.name?.split(" ")[0] ?? "they"} accept{other.name ? "s" : ""}.</p>}
          {conversation?.status === "declined" && conversation.requestedByMe && <p className="mb-2 px-1 font-lp-body text-[12px] text-app-muted">{other.name?.split(" ")[0] ?? "This person"} isn&apos;t accepting messages from you.</p>}
          {error && <p role="alert" className="mb-2 px-1 font-lp-body text-[12px] text-app-rose">{error}</p>}
          <div className="flex items-end gap-2">
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value.slice(0, MAX))}
              onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (canSend && !sending) void send(); } }}
              placeholder={canSend ? "Write a message…" : "You can't reply yet"}
              aria-label="Message"
              disabled={!canSend}
              rows={1}
              className="max-h-32 min-h-[40px] flex-1 resize-none rounded-2xl border border-app-border bg-app-background px-4 py-2.5 font-lp-body text-[13.5px] focus:border-app-orange focus:outline-none focus:ring-2 focus:ring-app-orange/20 disabled:opacity-60"
            />
            <button type="button" onClick={send} disabled={!canSend || sending || !draft.trim()} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-app-orange text-white disabled:opacity-50">{sending ? <Loader2 size={15} className="animate-spin" /> : <Send size={15} />}</button>
          </div>
        </div>
      )}
      {reporting && <ReportDialog targetType={reporting.type} targetId={reporting.id} onClose={() => setReporting(null)} />}
    </div>
  );
}
