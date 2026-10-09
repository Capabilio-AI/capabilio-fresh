"use client";

import Link from "next/link";
import { PolarAngleAxis, PolarGrid, PolarRadiusAxis, Radar, RadarChart, ResponsiveContainer } from "recharts";
import { Lock } from "lucide-react";
import type { CareerProfile } from "@/lib/assess/career-profile";
import type { SkillResult } from "@/lib/assess/scoring";
import { developmentPhrase } from "@/lib/assess/scoring";
import { useCareerProfile } from "../hooks/useCareerProfile";

// Four surfaces, one object. Each view below is a pure function of CareerProfile; the wrappers feed them from useCareerProfile (the
// same endpoint everywhere). If you ever need a number on screen, take it from `profile`; do not calculate it again.

const CONF: Record<SkillResult["confidence"], string> = { HIGH: "High confidence", MEDIUM: "Medium confidence", LOW: "Low confidence", INSUFFICIENT: "Insufficient evidence" };
const DOTS: Record<SkillResult["confidence"], number> = { HIGH: 3, MEDIUM: 2, LOW: 1, INSUFFICIENT: 0 };

export function ConfidenceDots({ level }: { level: SkillResult["confidence"] }) {
  return (
    <span className="inline-flex items-center gap-1.5 whitespace-nowrap text-[12px] text-[var(--m-muted)]" title={CONF[level]}>
      <span className="flex gap-0.5" aria-hidden>{[0, 1, 2].map((i) => <span key={i} className={`h-1.5 w-1.5 rounded-full ${i < DOTS[level] ? "bg-[var(--m-ink)]" : "bg-[var(--m-soft)]"}`} />)}</span>
      {CONF[level]}
    </span>
  );
}

function Locked({ what, unlocked = false }: { what: string; unlocked?: boolean }) {
  return unlocked ? (
    <div className="glass flex items-center gap-3 rounded-2xl p-5 text-[14px] text-[var(--m-muted)]">
      <Lock className="h-4 w-4 shrink-0" aria-hidden />
      <span>{what} will appear once you take the career assessment. <Link href="/assessment?retake=1" className="font-bold text-[var(--m-ink)] underline underline-offset-4">Take the career assessment</Link></span>
    </div>
  ) : (
    <div className="glass flex items-center gap-3 rounded-2xl p-5 text-[14px] text-[var(--m-muted)]">
      <Lock className="h-4 w-4 shrink-0" aria-hidden />
      <span>{what} will appear after you finish your assessment. <Link href="/assessment" className="font-bold text-[var(--m-ink)] underline underline-offset-4">Continue Assessment</Link></span>
    </div>
  );
}

// ---- ELO + readiness card -------------------------------------------------------------------------------------------
export function EloCardView({ profile }: { profile: CareerProfile }) {
  if (!profile.unlocked || !profile.elo || !profile.role) return <Locked what="Your career rating" unlocked={profile.unlocked} />;
  const { elo } = profile;
  const sign = (n: number) => `${n >= 0 ? "+" : "−"}${Math.abs(n)}`;
  return (
    <section className="glass relative overflow-hidden rounded-3xl p-6" aria-labelledby="elo-title" data-testid="elo-card">
      <h2 id="elo-title" className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">{profile.role.name} ELO</h2>
      <div className="mt-1 flex flex-wrap items-end justify-between gap-4">
        <p className="font-lp-display text-[56px] font-bold leading-none tabular-nums text-[var(--m-ink)]" data-testid="elo-value">{elo.rating}</p>
        <div className="text-right text-[13.5px] text-[var(--m-muted)]">
          <p><span className="font-bold text-[var(--m-ink)]" data-testid="readiness-value">{profile.readiness}%</span> career readiness</p>
          <p className="text-[12px]">Based on {profile.skills.filter((s) => s.score !== null).length} of {profile.skills.length} skills</p>
        </div>
      </div>
      <dl className="mt-4 grid grid-cols-2 gap-2.5 text-[13px]">
        <div className="rounded-xl bg-white/60 p-3"><dt className="text-[var(--m-muted)]">From the assessment</dt><dd className="font-bold text-[var(--m-ink)]">{sign(elo.fromAssessment)}</dd></div>
        <div className="rounded-xl bg-white/60 p-3"><dt className="text-[var(--m-muted)]">From Arena</dt><dd className="font-bold text-[var(--m-ink)]">{sign(elo.fromArena)}</dd></div>
      </dl>
      <p className="mt-3 text-[12px] text-[var(--m-muted)]">ELO is a performance rating, not a percentage. Readiness is how closely your skills match the role.</p>
    </section>
  );
}

// ---- Skills section ---------------------------------------------------------------------------------------------------
export function SkillsView({ profile }: { profile: CareerProfile }) {
  if (!profile.unlocked || profile.skills.length === 0) return <Locked what="Your skills" unlocked={profile.unlocked} />;
  return (
    <section className="glass rounded-3xl p-6" aria-labelledby="skills-title" data-testid="skills-section">
      <h2 id="skills-title" className="text-[12.5px] font-bold uppercase tracking-wider text-[var(--m-muted)]">{profile.role?.name} skills</h2>
      <ul className="mt-3 divide-y divide-[var(--m-rule)]">
        {profile.skills.map((s) => (
          <li key={s.skillId} className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1 py-2.5" data-skill={s.skillId}>
            <span className="text-[14.5px] font-bold text-[var(--m-ink)]">{s.name}</span>
            <span className="flex items-center gap-4">
              <ConfidenceDots level={s.confidence} />
              <span className="w-10 text-right text-[15px] font-bold tabular-nums text-[var(--m-ink)]" data-score>{s.score === null ? "—" : s.score}</span>
            </span>
          </li>
        ))}
      </ul>
      <p className="mt-3 text-[12.5px] text-[var(--m-muted)]">{profile.skills.filter((s) => s.score === null).map((s) => s.name).join(", ") || "Every skill has been measured"}{profile.skills.some((s) => s.score === null) ? " need more evidence." : "."}</p>
    </section>
  );
}

// ---- Skill graph tab ---------------------------------------------------------------------------------------------------
export function SkillGraphView({ profile }: { profile: CareerProfile }) {
  if (!profile.unlocked || profile.skills.length === 0) return <Locked what="Your skill graph" unlocked={profile.unlocked} />;
  const data = profile.skills.map((s) => ({ skill: s.name, score: s.score ?? 0, target: s.targetLevel }));
  const focus = [...profile.skills].filter((s) => s.score !== null && s.score < s.targetLevel).sort((a, b) => b.weight * (b.targetLevel - (b.score ?? 0)) - a.weight * (a.targetLevel - (a.score ?? 0))).slice(0, 3);
  const strongest = [...profile.skills].filter((s) => s.score !== null).sort((a, b) => b.score! - a.score!).slice(0, 3);
  return (
    <section className="space-y-5" aria-labelledby="graph-title" data-testid="skill-graph">
      <div className="glass rounded-3xl p-6">
        <h2 id="graph-title" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">{profile.role?.name} skill graph</h2>
        <p className="mt-1 text-[13.5px] text-[var(--m-muted)]">Every skill this role needs. The dashed outline is the level the role asks for.</p>
        <div className="mt-3 h-[26rem] w-full sm:h-[30rem]" role="img" aria-label={`Radar chart of ${profile.skills.length} skills; the list below has every value`}>
          <ResponsiveContainer width="100%" height="100%">
            <RadarChart data={data} outerRadius="66%">
              <PolarGrid stroke="rgb(23 19 31 / 0.14)" />
              <PolarAngleAxis dataKey="skill" tick={{ fontSize: 11, fill: "var(--m-muted)" }} />
              <PolarRadiusAxis angle={90} domain={[0, 100]} tick={false} axisLine={false} />
              <Radar name="Role target" dataKey="target" stroke="var(--m-off)" strokeDasharray="4 4" fill="none" />
              <Radar name="You" dataKey="score" stroke="var(--m-accent)" fill="var(--m-accent)" fillOpacity={0.25} strokeWidth={2} />
            </RadarChart>
          </ResponsiveContainer>
        </div>
      </div>
      <div className="grid gap-5 md:grid-cols-2">
        <div className="glass rounded-3xl p-6"><h3 className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Strongest skills</h3>{strongest.length ? <ul className="mt-2 space-y-1.5 text-[14.5px]">{strongest.map((s) => <li key={s.skillId} className="flex justify-between"><span className="font-bold text-[var(--m-ink)]">{s.name}</span><span className="tabular-nums text-[var(--m-muted)]">{s.score}/100</span></li>)}</ul> : <p className="mt-2 text-[14px] text-[var(--m-muted)]">Not enough evidence yet.</p>}</div>
        <div className="glass rounded-3xl p-6"><h3 className="font-lp-display text-[18px] font-bold text-[var(--m-ink)]">Focus areas</h3>{focus.length ? <ul className="mt-2 space-y-1.5 text-[14.5px] text-[var(--m-ink)]">{focus.map((s) => <li key={s.skillId}>{developmentPhrase(s.name)}</li>)}</ul> : <p className="mt-2 text-[14px] text-[var(--m-muted)]">At or above target on everything measured.</p>}</div>
      </div>
    </section>
  );
}

// ---- wrappers: the same hook, the same endpoint ------------------------------------------------------------------------
function useView(initial?: CareerProfile | null) {
  const { profile, loading, error } = useCareerProfile(initial);
  return { profile, loading, error };
}
const Skeleton = () => <div className="glass h-40 rounded-3xl"><span className="a-skeleton m-6 block h-5 w-1/3" /></div>;

export function ProfileEloCard({ initial }: { initial?: CareerProfile | null }) {
  const { profile, loading, error } = useView(initial);
  return error ? <p role="alert">{error}</p> : loading || !profile ? <Skeleton /> : <EloCardView profile={profile} />;
}
export function ProfileSkills({ initial }: { initial?: CareerProfile | null }) {
  const { profile, loading, error } = useView(initial);
  return error ? <p role="alert">{error}</p> : loading || !profile ? <Skeleton /> : <SkillsView profile={profile} />;
}
export function ProfileSkillGraph({ initial }: { initial?: CareerProfile | null }) {
  const { profile, loading, error } = useView(initial);
  return error ? <p role="alert">{error}</p> : loading || !profile ? <Skeleton /> : <SkillGraphView profile={profile} />;
}
