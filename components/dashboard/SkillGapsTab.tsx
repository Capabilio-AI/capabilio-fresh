"use client";

import { gapTier, type CareerMatch, type GapTier, type SkillGap } from "@/lib/career/skill-gap";
import { DECAY_LABEL, type SkillPracticeRecency } from "@/lib/career/skill-decay";
import { EmptyState } from "@/components/dashboard/SkillsTab";
import { RoundRadar } from "@/components/metro/RoundRadar";

const RECOMMENDATION_CLASSES: Record<CareerMatch["recommendation"], string> = {
  Ready: "bg-lp-success-container text-lp-on-success-container",
  Explore: "bg-lp-accent-ochre/15 text-lp-accent-ochre",
  "Long-term pathway": "bg-lp-surface-subtle text-lp-text-muted",
};

const TIER_SECTION: Record<GapTier, { label: string; dot: string }> = {
  critical: { label: "Critical gaps", dot: "bg-lp-error" },
  moderate: { label: "Moderate gaps", dot: "bg-lp-accent-ochre" },
  met: { label: "On track", dot: "bg-lp-success" },
};

const DECAY_DOT: Record<SkillPracticeRecency["decayState"], string> = {
  fresh: "bg-lp-success",
  aging: "bg-lp-accent-ochre",
  at_risk: "bg-lp-accent-ochre",
  decayed: "bg-lp-error",
  not_practiced: "bg-lp-text-muted/40",
};

function groupByTier(gaps: SkillGap[]): Record<GapTier, SkillGap[]> {
  const groups: Record<GapTier, SkillGap[]> = { critical: [], moderate: [], met: [] };
  for (const gap of gaps) groups[gapTier(gap.gap)].push(gap);
  return groups;
}

function SkillRow({ gap, recency }: { gap: SkillGap; recency?: SkillPracticeRecency }) {
  return (
    <div>
      <div className="flex items-center justify-between font-lp-mono text-lp-label-sm text-lp-text-muted">
        <span className="flex items-center gap-1.5 text-lp-text-ink">
          {gap.skill}
          {gap.current !== null && recency && (
            <span
              title={DECAY_LABEL[recency.decayState]}
              className={`h-1.5 w-1.5 rounded-full ${DECAY_DOT[recency.decayState]}`}
            />
          )}
        </span>
        <span>
          {gap.current === null ? "Not assessed" : `${gap.current}%`} · target {gap.required}%
        </span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-lp-surface-subtle">
        <div
          className={`h-full rounded-full ${gap.gap > 0 ? "bg-lp-accent-ochre" : "bg-lp-success"}`}
          style={{ width: `${Math.min(100, ((gap.current ?? 0) / gap.required) * 100)}%` }}
        />
      </div>
      {gap.current !== null && recency && (
        <p className="mt-1 font-lp-mono text-[10.5px] text-lp-text-muted">{DECAY_LABEL[recency.decayState]}</p>
      )}
    </div>
  );
}

export function SkillGapsTab({
  matches,
  practiceRecency = new Map(),
}: {
  matches: CareerMatch[];
  practiceRecency?: Map<string, SkillPracticeRecency>;
}) {
  if (matches.length === 0) {
    return <EmptyState message="No career requirements to compare against yet." />;
  }

  return (
    <div className="flex flex-col gap-5">
      {matches.map((match) => {
        const groups = groupByTier(match.skillGaps);
        return (
          <div
            key={match.careerRole}
            className="rounded-xl border border-lp-border-hairline bg-lp-surface-card p-5 shadow-sm"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h3 className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
                {match.careerRole}
              </h3>
              <span
                className={`rounded-full px-3 py-1 font-lp-mono text-lp-label-sm font-semibold ${RECOMMENDATION_CLASSES[match.recommendation]}`}
              >
                {match.recommendation} — {match.overallReadiness}% ready
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-3 font-lp-mono text-[11px] text-lp-text-muted">
              {(["critical", "moderate", "met"] as const)
                .filter((tier) => groups[tier].length > 0)
                .map((tier) => (
                  <span key={tier} className="flex items-center gap-1.5">
                    <span className={`h-1.5 w-1.5 rounded-full ${TIER_SECTION[tier].dot}`} />
                    {groups[tier].length} {TIER_SECTION[tier].label.toLowerCase()}
                  </span>
                ))}
            </div>

            {match.skillGaps.length >= 3 && (
              <div className="mt-4">
                <RoundRadar caption={`${match.careerRole} skills`} axes={match.skillGaps.map((g) => ({ label: g.skill, value: g.current, target: g.required }))} />
              </div>
            )}

            <div className="mt-4 flex flex-col gap-5">
              {(["critical", "moderate", "met"] as const)
                .filter((tier) => groups[tier].length > 0)
                .map((tier) => (
                  <div key={tier}>
                    <p className="mb-2 font-lp-mono text-lp-label-sm font-semibold uppercase tracking-wide text-lp-text-muted">
                      {TIER_SECTION[tier].label}
                    </p>
                    <div className="flex flex-col gap-3">
                      {groups[tier].map((gap) => (
                        <SkillRow key={gap.skill} gap={gap} recency={practiceRecency.get(gap.skill)} />
                      ))}
                    </div>
                  </div>
                ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}
