"use client";

import { useState } from "react";
import { Lock } from "lucide-react";
import clsx from "clsx";
import { PulseFeed } from "@/components/pulse/PulseFeed";

const TABS = ["For You", "Following", "Communities", "Mentors"] as const;
type Tab = (typeof TABS)[number];

const LOCKED_COPY: Record<Exclude<Tab, "For You">, string> = {
  Following: "Follow mentors, peers, and industry voices to build a feed of just their updates.",
  Communities: "Branch and college communities are coming — join discussions with people on your track.",
  Mentors: "A dedicated feed of mentor posts and office hours is on the way.",
};

export function PulseTabs() {
  const [active, setActive] = useState<Tab>("For You");

  return (
    <div>
      <div className="flex gap-1 border-b border-app-border">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={clsx(
              "relative flex items-center gap-1.5 px-3.5 py-3 font-lp-body text-[13.5px] font-medium transition-colors",
              active === tab ? "text-app-charcoal" : "text-app-muted hover:text-app-charcoal"
            )}
          >
            {tab}
            {tab !== "For You" && <Lock size={11} className="text-app-muted" />}
            {active === tab && <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-app-orange" />}
          </button>
        ))}
      </div>

      <div className="pt-6">
        {active === "For You" ? (
          <PulseFeed />
        ) : (
          <div className="mx-auto flex max-w-2xl flex-col items-center gap-2 rounded-xl border border-dashed border-app-border bg-white px-6 py-14 text-center">
            <Lock size={18} className="text-app-muted" />
            <p className="font-lp-body text-[13.5px] text-app-muted">{LOCKED_COPY[active]}</p>
          </div>
        )}
      </div>
    </div>
  );
}
