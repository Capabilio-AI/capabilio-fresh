"use client";

import { useState, type ReactNode } from "react";

const TABS = ["Overview", "Skills", "Skill Gaps", "Vault"] as const;
type Tab = (typeof TABS)[number];

export function DashboardTabs({
  overview,
  skills,
  skillGaps,
  vault,
}: {
  overview: ReactNode;
  skills: ReactNode;
  skillGaps: ReactNode;
  vault: ReactNode;
}) {
  const [active, setActive] = useState<Tab>("Overview");
  const content: Record<Tab, ReactNode> = { Overview: overview, Skills: skills, "Skill Gaps": skillGaps, Vault: vault };

  return (
    <div>
      <div className="flex gap-1 border-b border-lp-border-hairline">
        {TABS.map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActive(tab)}
            className={`relative px-4 py-3 font-lp-body text-lp-body-sm font-medium transition-colors ${
              active === tab ? "text-lp-text-ink" : "text-lp-text-muted hover:text-lp-text-ink"
            }`}
          >
            {tab}
            {active === tab && (
              <span className="absolute inset-x-0 -bottom-px h-0.5 rounded-full bg-lp-accent-indigo" />
            )}
          </button>
        ))}
      </div>
      <div className="pt-6">{content[active]}</div>
    </div>
  );
}
