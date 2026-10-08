"use client";

import { useEffect, useState } from "react";
import { Sparkles, X } from "lucide-react";
import { MentorChat } from "@/components/mentor/MentorChat";
import { OPEN_MENTOR_EVENT } from "@/components/mentor/events";

const OPENING =
  "Hi, I'm your AI Mentor. Ask me about your profile: how to raise your ELO score, close your skill gaps, or what to learn next.";

/** Floating chatbot available on every signed-in page. */
export function MentorWidget() {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    const show = () => setOpen(true);
    window.addEventListener(OPEN_MENTOR_EVENT, show);
    return () => window.removeEventListener(OPEN_MENTOR_EVENT, show);
  }, []);

  return (
    <div className="fixed bottom-4 right-4 z-30 flex flex-col items-end gap-3 sm:bottom-6 sm:right-6">
      {/* kept mounted while closed so the conversation survives toggling */}
      <div className={open ? "w-[min(92vw,380px)]" : "hidden"} role="dialog" aria-label="AI Mentor">
        <MentorChat openingMessage={OPENING} />
      </div>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-label={open ? "Close AI Mentor" : "Open AI Mentor"}
        aria-expanded={open}
        className="flex h-14 w-14 items-center justify-center rounded-full bg-[#141414] text-[#ff5701] shadow-[0_10px_28px_-8px_rgba(20,20,20,0.55)] transition-transform duration-200 hover:scale-105 active:scale-95 motion-reduce:transition-none"
      >
        {open ? <X size={20} /> : <Sparkles size={22} />}
      </button>
    </div>
  );
}
