"use client";

import { ArrowRight } from "lucide-react";
import { OPEN_MENTOR_EVENT } from "@/components/mentor/events";

export function AskMentorButton() {
  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event(OPEN_MENTOR_EVENT))}
      className="mt-3 flex items-center gap-1.5 font-lp-body text-[12.5px] font-semibold text-app-charcoal hover:underline"
    >
      Ask AI Mentor
      <ArrowRight size={13} />
    </button>
  );
}
