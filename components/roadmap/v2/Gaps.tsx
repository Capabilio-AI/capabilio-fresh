import type { RoadmapView } from "@/lib/roadmap-engine/read";
import { Bar, Card, Empty, Pill, Section } from "./ui";

const IMPORTANCE = { CRITICAL: "Critical", IMPORTANT: "Important", NICE_TO_HAVE: "Nice to have" } as Record<string, string>;
const GAP_TYPE: Record<string, string> = {
  COVERED_BY_CURRICULUM: "Your curriculum covers this",
  PARTIALLY_COVERED: "Partly covered by your curriculum",
  NOT_COVERED: "Not in your curriculum",
  NEEDS_PRACTICAL_EXPERIENCE: "Needs hands-on practice",
  NEEDS_EXTERNAL_LEARNING: "Needs learning outside college",
};

export function NextAction({ action }: { action: RoadmapView["nextBestAction"] }) {
  if (!action) return null;
  return (
    <div className="rounded-2xl border border-app-orange/40 bg-app-orange-container p-5" aria-labelledby="next-action">
      <p id="next-action" className="font-lp-mono text-[11px] uppercase text-app-orange">Your next best step</p>
      <p className="mt-1 font-lp-display text-[18px] font-semibold text-app-charcoal">{action.title}</p>
      <p className="mt-1 font-lp-body text-[13px] text-app-charcoal">{action.reason}</p>
    </div>
  );
}

export function Gaps({ gaps, unmatched }: { gaps: RoadmapView["gaps"]; unmatched: string[] }) {
  return (
    <Section id="gaps" title="Skills for this career" blurb="Where you are now against what the career needs. Verified work counts fully; a self-declared skill counts for much less.">
      {gaps.length === 0 ? <Empty>This career has no required skills defined.</Empty> : (
        <ul className="grid grid-cols-1 gap-3 md:grid-cols-2">
          {gaps.map((g) => (
            <Card key={g.skillId}>
              <div className="flex items-start justify-between gap-2">
                <p className="font-lp-body text-[14px] font-semibold text-app-charcoal">{g.skillName}</p>
                <Pill>{IMPORTANCE[g.importance] ?? g.importance}</Pill>
              </div>
              {g.assessed ? (
                <>
                  <div className="mt-2"><Bar value={(g.currentLevel / Math.max(1, g.targetLevel)) * 100} label={`${g.skillName}: ${g.currentLevel} of ${g.targetLevel}`} tone={g.gap === 0 ? "bg-app-success" : "bg-app-orange"} /></div>
                  <p className="mt-1 font-lp-mono text-[11px] text-app-muted">{g.currentLevel} now · target {g.targetLevel}{g.gap > 0 ? ` · gap ${g.gap}` : " · met"}</p>
                </>
              ) : (
                <p className="mt-2 font-lp-body text-[13px] text-app-muted">Not assessed yet · target {g.targetLevel}</p>
              )}
              <p className="mt-2 font-lp-body text-[12.5px] text-app-muted">{g.gapType ? GAP_TYPE[g.gapType] ?? g.gapType : "Target met"}{g.selfDeclaredOnly ? " · self-declared, not yet verified" : g.verified ? " · verified" : ""}</p>
              {g.blockedBySkillId && <p className="mt-1 font-lp-body text-[12px] text-app-muted">Best tackled after the skill it builds on.</p>}
            </Card>
          ))}
        </ul>
      )}
      {unmatched.length > 0 && <p className="mt-3 font-lp-body text-[12px] text-app-muted">We couldn&apos;t match these to a career skill yet, so they aren&apos;t counted: {unmatched.join(", ")}.</p>}
    </Section>
  );
}
