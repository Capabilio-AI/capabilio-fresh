"use client";

import { useState } from "react";
import { ClipboardList, History, MessageSquareText, Star, Target, Users } from "lucide-react";
import clsx from "clsx";
import { InterviewSession } from "@/components/interview/InterviewSession";

const TABS = ["Practice", "Technical", "Behavioral", "HR", "History", "Feedback"] as const;
type Tab = (typeof TABS)[number];

const SESSION_TABS: Record<Extract<Tab, "Practice" | "Technical" | "Behavioral" | "HR">, {
  icon: typeof Target;
  description: string;
}> = {
  Practice: {
    icon: Target,
    description: "A mixed warm-up covering a bit of everything — good for your first session.",
  },
  Technical: {
    icon: ClipboardList,
    description: "Core CS fundamentals, problem-solving, and role-specific technical questions.",
  },
  Behavioral: {
    icon: MessageSquareText,
    description: "STAR-format questions about past projects, teamwork, and decision-making.",
  },
  HR: {
    icon: Users,
    description: "Culture-fit, salary expectations, and common HR-round questions.",
  },
};

export function InterviewTabs() {
  const [active, setActive] = useState<Tab>("Practice");

  return (
    <div>
      <div className="-mx-4 overflow-x-auto border-b border-[var(--m-rule)] px-4 sm:mx-0 sm:px-0">
        <div className="flex gap-1 whitespace-nowrap">
          {TABS.map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => setActive(tab)}
              className={clsx(
                "relative px-3.5 py-3 font-lp-body text-[13.5px] font-medium transition-colors",
                active === tab ? "text-[var(--m-ink)]" : "text-app-muted hover:text-[var(--m-ink)]"
              )}
            >
              {tab}
              {active === tab && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-app-orange" />}
            </button>
          ))}
        </div>
      </div>

      <div className="pt-6">
        {active === "History" && (
          <EmptyState icon={History} message="Your completed sessions will appear here." />
        )}
        {active === "Feedback" && (
          <EmptyState icon={Star} message="Feedback from completed sessions will appear here." />
        )}
        {active !== "History" && active !== "Feedback" && (
          <SessionEntry tab={active as keyof typeof SESSION_TABS} />
        )}
      </div>
    </div>
  );
}

function SessionEntry({ tab }: { tab: keyof typeof SESSION_TABS }) {
  const { icon: Icon, description } = SESSION_TABS[tab];
  const [sessionKey, setSessionKey] = useState(0);
  const [active, setActive] = useState(false);

  if (active) {
    return <InterviewSession key={sessionKey} mode={tab.toLowerCase() as "practice" | "technical" | "behavioral" | "hr"} onClose={() => setActive(false)} />;
  }

  return (
    <div className="flex flex-col items-start gap-3 rounded-xl border border-[var(--m-rule)] bg-white p-6">
      <span className="flex h-10 w-10 items-center justify-center rounded-lg bg-app-orange-container text-app-orange">
        <Icon size={18} />
      </span>
      <div>
        <h3 className="font-lp-body text-[15px] font-semibold text-[var(--m-ink)]">{tab} practice</h3>
        <p className="mt-1 max-w-md font-lp-body text-[13px] leading-relaxed text-app-muted">{description}</p>
      </div>
      <button
        type="button"
        onClick={() => {
          setSessionKey((k) => k + 1);
          setActive(true);
        }}
        className="mt-1 rounded-lg bg-app-orange px-4 py-2.5 font-lp-body text-[13px] font-semibold text-white"
      >
        Start practice session
      </button>
    </div>
  );
}

function EmptyState({ icon: Icon, message }: { icon: typeof History; message: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-[var(--m-rule)] bg-white px-6 py-14 text-center">
      <Icon size={20} className="text-app-muted" />
      <p className="font-lp-body text-[13.5px] text-app-muted">{message}</p>
    </div>
  );
}
