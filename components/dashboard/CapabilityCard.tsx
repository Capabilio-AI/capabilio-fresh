import { Gauge } from "lucide-react";
import type { SkillRow } from "@/lib/dashboard/data";

const MAX_DIMENSIONS = 5;

function aggregateByDomain(skills: SkillRow[]) {
  const byDomain = new Map<string, { total: number; count: number }>();
  for (const s of skills) {
    if (s.domain === "Career Interest Signal") continue;
    const bucket = byDomain.get(s.domain) ?? { total: 0, count: 0 };
    bucket.total += s.score;
    bucket.count += 1;
    byDomain.set(s.domain, bucket);
  }
  return [...byDomain.entries()]
    .map(([domain, { total, count }]) => ({ domain, score: Math.round(total / count), count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, MAX_DIMENSIONS);
}

export function overallCapabilityScore(skills: SkillRow[]): number | null {
  const dimensions = aggregateByDomain(skills);
  if (dimensions.length === 0) return null;
  return Math.round(dimensions.reduce((sum, d) => sum + d.score, 0) / dimensions.length);
}

export function CapabilityCard({ skills }: { skills: SkillRow[] }) {
  const dimensions = aggregateByDomain(skills);

  if (dimensions.length === 0) {
    return (
      <div className="flex h-full flex-col rounded-xl border border-[var(--m-rule)] bg-white p-5">
        <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--m-muted)]">
          <Gauge size={14} />
          Capability
        </div>
        <div className="mt-4 flex flex-1 flex-col items-center justify-center text-center">
          <p className="font-lp-body text-[13px] text-app-muted">Not enough data yet — this fills in as you complete assessments, challenges, and projects.</p>
        </div>
      </div>
    );
  }

  const overall = overallCapabilityScore(skills);

  return (
    <div className="flex h-full flex-col rounded-xl border border-[var(--m-rule)] bg-white p-5">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 text-[13px] font-bold text-[var(--m-muted)]">
          <Gauge size={14} />
          Capability
        </div>
        <span className="font-lp-display text-[28px] font-bold text-[var(--m-ink)]">{overall}%</span>
      </div>
      <p className="mt-1 font-lp-body text-[12px] text-app-muted">From your diagnostic assessment — updates as Arena and projects add evidence.</p>

      <div className="mt-4 flex flex-1 flex-col justify-center gap-3">
        {dimensions.map((d) => (
          <div key={d.domain}>
            <div className="flex items-center justify-between font-lp-body text-[12.5px]">
              <span className="truncate font-bold text-[var(--m-ink)]">{d.domain}</span>
              <span className="text-[13px] font-bold text-[var(--m-ink)]">{d.score}%</span>
            </div>
            <div className="mt-1 h-2 w-full overflow-hidden rounded-full bg-[var(--m-ground)]">
              <div className="h-full rounded-full bg-[var(--m-ink)]" style={{ width: `${d.score}%` }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
