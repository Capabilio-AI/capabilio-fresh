"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import { AttachButton, Linkified, MessageAttachment, PendingChip, type PendingFile } from "@/components/messages/attachments";
import type { ChatAttachment } from "@/lib/pulse/chat-attachment";
import type { ChatMessage } from "@/lib/org/chat";
import { timeAgo } from "@/lib/org/format";

const POLL_MS = 4000;

/**
 * One channel's conversation. New messages arrive by polling every few seconds (and pause while the tab is hidden);
 * your own message appears immediately. The server re-checks channel access on every request.
 */
export function ChatPanel({ channelId, channelName, initial, myUserId }: { channelId: string; channelName: string; initial: ChatMessage[]; myUserId: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>(initial);
  const [text, setText] = useState("");
  const [pending, setPending] = useState<PendingFile | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAt = useRef<string | undefined>(initial.at(-1)?.createdAt);
  const endRef = useRef<HTMLDivElement>(null);

  const append = useCallback((incoming: ChatMessage[]) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    lastAt.current = incoming.at(-1)?.createdAt ?? lastAt.current;
  }, []);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (stopped || document.hidden) return;
      try {
        const qs = new URLSearchParams({ channelId, ...(lastAt.current ? { after: lastAt.current } : {}) });
        const res = await fetch(`/api/org/chat/messages?${qs}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { messages: ChatMessage[] };
        if (!stopped) append(json.messages);
      } catch {
        // a missed poll is retried on the next tick
      }
    }
    const timer = setInterval(poll, POLL_MS);
    return () => {
      stopped = true;
      clearInterval(timer);
    };
  }, [channelId, append]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if ((!body && !pending) || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/chat/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ channelId, body, ...(pending ? { attachment: { path: pending.path, name: pending.name, size: pending.size, mime: pending.mime } } : {}) }) });
      const json = (await res.json().catch(() => null)) as { id?: string; createdAt?: string; attachment?: ChatAttachment | null; error?: string } | null;
      if (!res.ok || !json?.id || !json.createdAt) return setError(json?.error ?? "Message not sent. Try again.");
      append([{ id: json.id, authorId: myUserId, authorName: "You", body, createdAt: json.createdAt, attachment: json.attachment ?? null }]);
      setText("");
      setPending(null);
    } catch {
      setError("Connection problem. Your message wasn't sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-15rem)] min-h-[420px] flex-col">
      <div className="flex-1 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label={`Messages in ${channelName}`}>
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-[13px] text-app-muted">No messages yet. Say hello to your team.</p>
        ) : (
          <ul className="flex flex-col gap-3 py-2">
            {messages.map((m) => {
              const mine = m.authorId === myUserId;
              return (
                <li key={m.id} className={`flex flex-col ${mine ? "items-end" : "items-start"}`}>
                  <p className="mb-1 text-[11px] text-app-muted">
                    <span className="font-bold text-app-charcoal">{mine ? "You" : m.authorName}</span> · {timeAgo(m.createdAt)}
                  </p>
                  <div className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${mine ? "text-[var(--o-ink-on-gold)]" : "bg-white/[0.07] text-app-charcoal"}`} style={mine ? { background: "var(--o-gradient)" } : undefined}>
                    {m.attachment && <MessageAttachment attachment={m.attachment} mine={mine} />}
                    {m.body && <Linkified text={m.body} mine={mine} />}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div ref={endRef} />
      </div>
      {error && (
        <p role="alert" className="pb-2 text-[12.5px] text-app-rose">
          {error}
        </p>
      )}
      {pending && (
        <div className="pt-2">
          <PendingChip file={pending} onRemove={() => setPending(null)} />
        </div>
      )}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-app-border pt-3">
        <AttachButton onPicked={setPending} onError={setError} disabled={busy} className="!h-11 !w-11" />
        <label className="sr-only" htmlFor="chat-input">
          Message {channelName}
        </label>
        <textarea
          id="chat-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              e.currentTarget.form?.requestSubmit();
            }
          }}
          rows={1}
          maxLength={2000}
          placeholder={`Message ${channelName}, or attach a file`}
          className="o-input max-h-32 min-h-[44px] flex-1 resize-none"
        />
        <button type="submit" className="o-btn !h-11 !px-4" disabled={busy || (!text.trim() && !pending)} aria-label="Send message">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}
