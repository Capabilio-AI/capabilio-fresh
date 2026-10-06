import type { Relevance, RelevanceMatch } from "@/lib/careers/relevance";
import { Pill } from "@/components/org/ui";

const TONE = { HIGH: "ok", MEDIUM: "info", LOW: "neutral", NONE: "neutral" } as const;
const LABEL: Record<Relevance, string> = { HIGH: "High", MEDIUM: "Medium", LOW: "Low", NONE: "No match" };
const REQ: Record<RelevanceMatch["requirement"], string> = { CRITICAL: "critical", HIGH: "high", MEDIUM: "medium", LOW: "low" };
const MAP: Record<RelevanceMatch["mapping"], string> = { CORE: "a core skill", SUPPORTING: "a supporting skill", MINOR: "a minor skill" };

export const RelevancePill = ({ label }: { label: Relevance }) => <Pill tone={TONE[label]}>{LABEL[label]}</Pill>;

/** Why a course scored the way it did: the skills that drove it, how much the career needs each, and how strongly the course teaches it. */
export function WhyRelevant({ matches, names, score }: { matches: RelevanceMatch[]; names: Map<string, string>; score: number }) {
  if (matches.length === 0) return <p className="mt-2 font-lp-body text-[12px] text-app-muted">None of this course&apos;s confirmed skills are among what this career asks for.</p>;
  return (
    <div className="mt-2">
      <p className="font-lp-body text-[12px] text-app-muted">Covers about {Math.round(score * 100)}% of what this career asks for, weighted by importance and target level.</p>
      <ul className="mt-1.5 list-disc pl-5 font-lp-body text-[12.5px] leading-relaxed text-app-charcoal">
        {matches.map((m) => <li key={m.skillId}>{names.get(m.skillId) ?? "A skill"} — {REQ[m.requirement]} for this career; this course teaches it as {MAP[m.mapping]}.</li>)}
      </ul>
    </div>
  );
}
