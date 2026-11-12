"use client";

import { useCallback, useEffect, useRef, useState, type FormEvent } from "react";
import { Loader2, Send } from "lucide-react";
import type { ThreadMessage } from "@/lib/org/threads";
import { timeAgo } from "@/lib/org/format";

const POLL_MS = 4000;

/** One conversation between a college and a company. Polls for new messages (paused while the tab is hidden); the server re-checks access on every request. */
export function ThreadPanel({ threadId, otherName, initial }: { threadId: string; otherName: string; initial: ThreadMessage[] }) {
  const [messages, setMessages] = useState<ThreadMessage[]>(initial);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const lastAt = useRef<string | undefined>(initial.at(-1)?.createdAt);
  const endRef = useRef<HTMLDivElement>(null);
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    const first = setTimeout(() => setNow(new Date()), 0);
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => { clearTimeout(first); clearInterval(timer); };
  }, []);

  // advanceCursor is false for the sender's own message: moving the poll cursor past it could skip a reply that arrived since the last poll (duplicates are dropped by id)
  const append = useCallback((incoming: ThreadMessage[], advanceCursor = true) => {
    if (incoming.length === 0) return;
    setMessages((prev) => {
      const seen = new Set(prev.map((m) => m.id));
      const fresh = incoming.filter((m) => !seen.has(m.id));
      return fresh.length ? [...prev, ...fresh] : prev;
    });
    if (advanceCursor) lastAt.current = incoming.at(-1)?.createdAt ?? lastAt.current;
  }, []);

  useEffect(() => {
    let stopped = false;
    async function poll() {
      if (stopped || document.hidden) return;
      try {
        const qs = new URLSearchParams({ threadId, ...(lastAt.current ? { after: lastAt.current } : {}) });
        const res = await fetch(`/api/org/threads/messages?${qs}`, { cache: "no-store" });
        if (!res.ok) return;
        const json = (await res.json()) as { messages: ThreadMessage[] };
        if (!stopped) append(json.messages);
      } catch {
        // a missed poll is retried on the next tick
      }
    }
    const timer = setInterval(poll, POLL_MS);
    return () => { stopped = true; clearInterval(timer); };
  }, [threadId, append]);

  useEffect(() => {
    endRef.current?.scrollIntoView({ block: "end" });
  }, [messages.length]);

  async function send(e: FormEvent) {
    e.preventDefault();
    const body = text.trim();
    if (!body || busy) return;
    setBusy(true);
    setError(null);
    try {
      const res = await fetch("/api/org/threads/messages", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ threadId, body }) });
      const json = (await res.json().catch(() => null)) as { id?: string; createdAt?: string; error?: string } | null;
      if (!res.ok || !json?.id || !json.createdAt) return setError(json?.error ?? "Message not sent. Try again.");
      append([{ id: json.id, authorId: null, authorName: "You", mine: true, body, createdAt: json.createdAt }], false);
      setText("");
    } catch {
      setError("Connection problem. Your message wasn't sent.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex h-[calc(100vh-18rem)] min-h-[380px] flex-col">
      <div className="flex-1 overflow-y-auto pr-1" role="log" aria-live="polite" aria-label={`Messages with ${otherName}`}>
        {messages.length === 0 ? (
          <p className="mt-10 text-center text-[13px] text-[var(--m-muted)]">No messages yet. Say hello to {otherName}.</p>
        ) : (
          <ul className="flex flex-col gap-3 py-2">
            {messages.map((m) => (
              <li key={m.id} className={`flex flex-col ${m.mine ? "items-end" : "items-start"}`}>
                <p className="mb-1 text-[11px] text-[var(--m-muted)]">
                  <span className="font-bold text-[var(--m-ink)]">{m.mine ? "You" : m.authorName}</span>
                  {now && ` · ${timeAgo(m.createdAt, now)}`}
                </p>
                <div
                  className={`max-w-[85%] whitespace-pre-wrap break-words rounded-2xl px-3.5 py-2.5 text-[13.5px] leading-relaxed ${m.mine ? "text-[var(--o-ink-on-gold)]" : "bg-[var(--m-accent-soft)] text-[var(--m-ink)]"}`}
                  style={m.mine ? { background: "var(--o-gradient)" } : undefined}
                >
                  {m.body}
                </div>
              </li>
            ))}
          </ul>
        )}
        <div ref={endRef} />
      </div>
      {error && <p role="alert" className="pb-2 text-[12.5px] text-[#b3261e]">{error}</p>}
      <form onSubmit={send} className="flex items-end gap-2 border-t border-[var(--m-rule)]! pt-3">
        <label className="sr-only" htmlFor="thread-input">Message {otherName}</label>
        <textarea
          id="thread-input"
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
          placeholder={`Message ${otherName}`}
          className="o-input max-h-32 min-h-[44px] flex-1 resize-none"
        />
        <button type="submit" className="o-btn !h-11 !px-4" disabled={busy || !text.trim()} aria-label="Send message">
          {busy ? <Loader2 size={16} className="animate-spin" aria-hidden="true" /> : <Send size={16} aria-hidden="true" />}
        </button>
      </form>
    </div>
  );
}
