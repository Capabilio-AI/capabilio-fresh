"use client";

import { useState } from "react";
import type { SkillRow } from "@/lib/dashboard/data";
import { scoreTier, TIER_BAR, TIER_TEXT } from "@/components/dashboard/tier";
import { SkillRadarChart } from "@/components/dashboard/SkillRadarChart";

const CONFIDENCE_LABEL: Record<SkillRow["confidence"], string> = {
  low: "Low confidence",
  medium: "Medium confidence",
  high: "High confidence",
};

export function SkillsTab({
  skills,
  relevantSkills,
}: {
  skills: SkillRow[];
  relevantSkills?: Set<string>;
}) {
  const canFilter = Boolean(relevantSkills && relevantSkills.size > 0);
  const [showAll, setShowAll] = useState(!canFilter);

  if (skills.length === 0) {
    return <EmptyState message="No skill data yet — it's generated from your assessment results." />;
  }

  const visibleSkills =
    showAll || !relevantSkills ? skills : skills.filter((s) => relevantSkills.has(s.skill));

  const byDomain = new Map<string, SkillRow[]>();
  for (const skill of visibleSkills) {
    const bucket = byDomain.get(skill.domain) ?? [];
    bucket.push(skill);
    byDomain.set(skill.domain, bucket);
  }

  const radarData = [...byDomain.entries()].map(([domain, domainSkills]) => ({
    subject: domain,
    score: Math.round(domainSkills.reduce((sum, s) => sum + s.score, 0) / domainSkills.length),
  }));

  return (
    <div className="flex flex-col gap-6">
      {radarData.length >= 3 && (
        <div className="rounded-xl border border-lp-border-hairline bg-lp-surface-card p-4 shadow-sm">
          <SkillRadarChart data={radarData} series={[{ key: "score", label: "Average score", color: "#3457a6" }]} />
        </div>
      )}

      {canFilter && (
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setShowAll(false)}
            className={`rounded-full px-3 py-1.5 font-lp-mono text-[11px] font-semibold ${
              !showAll ? "bg-lp-text-ink text-white" : "border border-lp-border-hairline text-lp-text-muted"
            }`}
          >
            Relevant to your path
          </button>
          <button
            type="button"
            onClick={() => setShowAll(true)}
            className={`rounded-full px-3 py-1.5 font-lp-mono text-[11px] font-semibold ${
              showAll ? "bg-lp-text-ink text-white" : "border border-lp-border-hairline text-lp-text-muted"
            }`}
          >
            All skills ({skills.length})
          </button>
        </div>
      )}

      {visibleSkills.length === 0 ? (
        <EmptyState message="No skills match your closest career directions yet — check All skills for your full assessment breakdown." />
      ) : (
        [...byDomain.entries()].map(([domain, domainSkills]) => (
          <div key={domain}>
            <h3 className="mb-3 font-lp-mono text-lp-label-sm font-semibold uppercase tracking-wide text-lp-text-muted">
              {domain}
            </h3>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              {domainSkills.map((skill) => {
                const tier = scoreTier(skill.score);
                return (
                  <div
                    key={skill.skill}
                    className="rounded-xl border border-lp-border-hairline bg-lp-surface-card p-4 shadow-sm"
                  >
                    <div className="flex items-center justify-between">
                      <p className="font-lp-body text-lp-body-sm font-medium text-lp-text-ink">{skill.skill}</p>
                      <span className={`font-lp-display text-lp-body-lg font-semibold ${TIER_TEXT[tier]}`}>
                        {skill.score}
                      </span>
                    </div>
                    <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
                      <div className={`h-full rounded-full ${TIER_BAR[tier]}`} style={{ width: `${skill.score}%` }} />
                    </div>
                    <p className="mt-2 font-lp-mono text-lp-label-sm text-lp-text-muted">
                      {CONFIDENCE_LABEL[skill.confidence]}
                    </p>
                  </div>
                );
              })}
            </div>
          </div>
        ))
      )}
    </div>
  );
}

export function EmptyState({ message }: { message: string }) {
  return (
    <div className="rounded-xl border border-dashed border-lp-border-strong bg-lp-surface-subtle/50 px-6 py-12 text-center">
      <p className="font-lp-body text-lp-body-sm text-lp-text-muted">{message}</p>
    </div>
  );
}
