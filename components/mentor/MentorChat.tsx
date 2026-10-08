"use client";

import { useEffect, useRef, useState } from "react";
import { Loader2, Send, Sparkles } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

export function MentorChat({ openingMessage }: { openingMessage: string }) {
  const [messages, setMessages] = useState<ChatMessage[]>([{ role: "assistant", content: openingMessage }]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  async function send() {
    const content = draft.trim();
    if (content.length === 0 || sending) return;

    const history = messages;
    const next: ChatMessage[] = [...messages, { role: "user", content }];
    setMessages(next);
    setDraft("");
    setSending(true);

    try {
      const res = await fetch("/api/mentor/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message: content, history }),
      });
      const data = await res.json();
      setMessages([...next, { role: "assistant", content: data.reply as string }]);
    } catch {
      setMessages([
        ...next,
        { role: "assistant", content: "Something went wrong reaching the Mentor. Try again in a moment." },
      ]);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="flex h-[min(560px,70vh)] flex-col rounded-3xl border border-[#e1e1da] bg-white shadow-[0_24px_60px_-20px_rgba(20,20,20,0.45)]">
      <div className="flex-1 overflow-y-auto p-5">
        <div className="flex flex-col gap-4">
          {messages.map((m, i) => (
            <div key={i} className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 font-lp-body text-[13.5px] leading-relaxed ${
                  m.role === "user"
                    ? "bg-[#141414] text-white"
                    : "border border-[#e1e1da] bg-[#ffebdf] text-[#141414]"
                }`}
              >
                {m.content}
              </div>
            </div>
          ))}
          {sending && (
            <div className="flex justify-start">
              <div className="flex items-center gap-2 rounded-xl border border-app-border bg-app-background px-4 py-2.5 text-app-muted">
                <Loader2 size={14} className="animate-spin" />
                <span className="font-lp-mono text-[11px]">Thinking…</span>
              </div>
            </div>
          )}
          <div ref={bottomRef} />
        </div>
      </div>

      <div className="flex items-end gap-2 border-t border-app-border p-3">
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              send();
            }
          }}
          placeholder="Ask your AI Mentor…"
          rows={1}
          disabled={sending}
          className="max-h-28 flex-1 resize-none rounded-lg border border-app-border bg-app-background px-3.5 py-2.5 font-lp-body text-[13px] text-app-charcoal placeholder:text-app-muted focus:border-[#ff5701] focus:outline-none focus:ring-2 focus:ring-[#ff5701]/25 disabled:opacity-60"
        />
        <button
          type="button"
          onClick={send}
          disabled={sending || draft.trim().length === 0}
          aria-label="Send message"
          className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-[#141414] text-[#ff5701] disabled:cursor-not-allowed disabled:opacity-50"
        >
          {sending ? <Loader2 size={16} className="animate-spin" /> : <Send size={16} />}
        </button>
      </div>
      <div className="flex items-center gap-1.5 border-t border-app-border px-3 py-2 font-lp-mono text-[10.5px] text-app-muted">
        <Sparkles size={11} />
        Profile guidance only — ELO, skills and learning. Not saved between visits.
      </div>
    </div>
  );
}
