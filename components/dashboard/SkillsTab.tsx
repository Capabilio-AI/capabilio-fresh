"use client";

import Link from "next/link";
import { RoundRadar } from "@/components/metro/RoundRadar";

/** One skill the student's career asks for. score is null until something measures it. */
export interface CareerSkill {
  skill: string;
  domain: string;
  score: number | null;
  required: number;
}

/**
 * The skill graph for the student's own career and nothing else: every skill the career asks for, grouped by domain, each domain a line and each
 * skill a station on it. Scores are plain percentages; a skill nobody has measured says so instead of showing 0.
 */
export function SkillsTab({ careerName, skills }: { careerName: string | null; skills: CareerSkill[] }) {
  if (!careerName) return <EmptyState message="Choose a career direction and its skills appear here as a graph." action={{ href: "/dashboard/roadmap", label: "Choose a career" }} />;
  if (skills.length === 0) return <EmptyState message={`We don't have a skill list for ${careerName} yet.`} />;

  const measuredTotal = skills.filter((s) => s.score !== null).length;

  return (
    <div className="flex flex-col gap-4">
      <div>
        <h2 className="font-lp-display text-[22px] font-bold text-[var(--m-ink)]">Skill graph: {careerName}</h2>
        <p className="mt-1 max-w-[70ch] font-lp-body text-[13.5px] text-app-muted">
          Every skill this role needs. The dashed outline is the level the role asks for. {measuredTotal} of {skills.length} measured so far; the rest need a diagnostic, Arena challenge or project.
        </p>
      </div>
      <div className="rounded-xl border border-[var(--m-rule)] bg-white p-4">
        <RoundRadar caption={`${careerName} skills`} axes={skills.map((s) => ({ label: s.skill, value: s.score, target: s.required }))} />
      </div>
    </div>
  );
}

export function EmptyState({ message, action }: { message: string; action?: { href: string; label: string } }) {
  return (
    <div className="rounded-xl border border-dashed border-[var(--m-off)] bg-white px-6 py-12 text-center">
      <p className="font-lp-body text-[14px] text-app-muted">{message}</p>
      {action && <Link href={action.href} className="mt-4 inline-block rounded-lg bg-[var(--m-ink)] px-4 py-2 text-[13px] font-bold text-white">{action.label}</Link>}
    </div>
  );
}
