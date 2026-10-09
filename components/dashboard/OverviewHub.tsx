import Link from "next/link";
import { ArrowRight, Flag, Swords, TrendingUp, Trophy } from "lucide-react";
import { JOB_READY_AT, MILESTONES, type Overview, type OverviewSkill } from "@/lib/dashboard/overview";
import { LiveRefresh } from "@/components/dashboard/LiveRefresh";

const CARD = "rounded-2xl border border-[var(--m-rule)] bg-white p-5";

function Ring({ value, size = 96, stroke = 10, color = "var(--m-accent)", children }: { value: number; size?: number; stroke?: number; color?: string; children?: React.ReactNode }) {
  const r = (size - stroke) / 2, c = 2 * Math.PI * r;
  return (
    <div className="relative shrink-0" style={{ width: size, height: size }}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.14)" strokeWidth={stroke} />
        <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke={color} strokeWidth={stroke} strokeLinecap="round" strokeDasharray={`${(Math.min(100, Math.max(0, value)) / 100) * c} ${c}`} />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">{children}</div>
    </div>
  );
}

/** The road to job-ready: four stations, a filled line up to the student's readiness, and a pin where they are now. */
function GoalTrack({ readiness }: { readiness: number }) {
  const pct = Math.min(100, (readiness / JOB_READY_AT) * 100);
  return (
    <div className="mt-6">
      <div className="relative h-3 rounded-full bg-white/15" role="img" aria-label={`Readiness ${readiness} percent; job-ready at ${JOB_READY_AT} percent`}>
        <div className="h-full rounded-full bg-[var(--m-accent)] transition-[width] duration-700 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
        {MILESTONES.map((m) => (
          <span key={m.at} aria-hidden className={`absolute top-1/2 h-4 w-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] ${readiness >= m.at ? "border-[var(--m-accent)] bg-white" : "border-white/40 bg-[var(--m-ink)]"}`} style={{ left: `${(m.at / JOB_READY_AT) * 100}%` }} />
        ))}
        <span aria-hidden className="absolute -top-7 -translate-x-1/2 rounded-md bg-white px-2 py-0.5 text-[11px] font-bold text-[var(--m-ink)]" style={{ left: `${pct}%` }}>You · {readiness}%</span>
      </div>
      <ol className="mt-3 flex justify-between text-[11.5px] text-white/65">
        {MILESTONES.map((m) => <li key={m.at} className={`text-center ${readiness >= m.at ? "font-bold text-white" : ""}`} style={{ width: "25%" }}>{m.label}<span className="block text-[10.5px] opacity-70">{m.at}%</span></li>)}
      </ol>
    </div>
  );
}

function MiniRing({ skill }: { skill: OverviewSkill }) {
  const size = 52, r = 20, c = 2 * Math.PI * r;
  return (
    <svg width={size} height={size} viewBox="0 0 52 52" aria-hidden className="shrink-0">
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--m-rule)" strokeWidth="6" />
      <circle cx="26" cy="26" r={r} fill="none" stroke="var(--m-accent)" strokeWidth="6" strokeLinecap="round" strokeDasharray={`${((skill.score ?? 0) / 100) * c} ${c}`} transform="rotate(-90 26 26)" />
      <text x="26" y="30" textAnchor="middle" fontSize="12" fontWeight="700" className="fill-[var(--m-ink)]">{skill.score ?? "–"}</text>
    </svg>
  );
}

function SkillRow({ skill, tone }: { skill: OverviewSkill; tone: "good" | "gap" }) {
  return (
    <li className="flex items-center gap-3">
      <MiniRing skill={skill} />
      <div className="min-w-0 flex-1">
        <p className="truncate font-lp-body text-[14px] font-bold text-[var(--m-ink)]" title={skill.name}>{skill.name}</p>
        <p className="text-[12px] text-app-muted">{tone === "gap" ? `${skill.gap} pts to reach ${skill.target}%` : `Role needs ${skill.target}%`}</p>
      </div>
    </li>
  );
}

export function OverviewHub({ o, vaultCount, yearLabel }: { o: Overview; vaultCount: number; yearLabel: string | null }) {
  const stats = [
    { label: "Skills measured", value: `${o.measured}/${o.total}` },
    { label: "Proof in your vault", value: vaultCount },
    { label: "Your stage", value: yearLabel ?? "–" },
  ];
  return (
    <div className="flex flex-col gap-5">
      <LiveRefresh />

      <section aria-labelledby="where" className="overflow-hidden rounded-2xl bg-[var(--m-ink)] p-6 text-white sm:p-7">
        <div className="grid items-center gap-6 md:grid-cols-[auto_1fr_auto]">
          <Ring value={o.readiness} size={112} stroke={11}>
            <div className="text-center"><p className="font-lp-display text-[30px] font-bold leading-none">{o.readiness}%</p><p className="mt-0.5 text-[10.5px] uppercase tracking-wide text-white/60">ready</p></div>
          </Ring>
          <div className="min-w-0">
            <p id="where" className="flex items-center gap-2 font-lp-mono text-[11px] font-semibold uppercase tracking-wide text-white/60"><Flag size={13} aria-hidden />Your goal: {o.roleName}</p>
            <h2 className="mt-1.5 font-lp-display text-[24px] font-bold leading-tight sm:text-[28px]">
              {o.pointsToGoal === 0 ? "You've reached job-ready. Keep proving it." : `${o.pointsToGoal} points to job-ready`}
            </h2>
            <p className="mt-1 text-[13.5px] text-white/70">{o.nextMilestone ? `Next station: ${o.nextMilestone.label} at ${o.nextMilestone.at}%.` : "Every station on the road is behind you."}</p>
          </div>
          <div className="rounded-xl bg-white/10 px-5 py-4 text-center md:text-right">
            <p className="flex items-center justify-center gap-1.5 font-lp-mono text-[11px] uppercase tracking-wide text-white/60 md:justify-end"><Trophy size={13} aria-hidden />{o.roleName} ELO</p>
            <p className="font-lp-display text-[38px] font-bold leading-none">{o.elo}</p>
            <p className="mt-1 text-[12px] font-bold" style={{ color: o.tier.color }}>{o.tier.label}</p>
            <div className="mt-2 h-1.5 w-full rounded-full bg-white/15" role="img" aria-label={`${o.tierProgress} percent to ${o.nextTier ?? "the top tier"}`}><div className="h-full rounded-full" style={{ width: `${o.tierProgress}%`, background: o.tier.color }} /></div>
            {o.nextTier && <p className="mt-1 text-[11px] text-white/55">{o.tierProgress}% to {o.nextTier}</p>}
          </div>
        </div>
        <GoalTrack readiness={o.readiness} />
      </section>

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-3">
        <section className={CARD} aria-labelledby="strong">
          <h3 id="strong" className="flex items-center gap-2 font-lp-display text-[17px] font-bold text-[var(--m-ink)]"><TrendingUp size={16} aria-hidden />Your strongest skills</h3>
          {o.strengths.length ? <ul className="mt-4 flex flex-col gap-4">{o.strengths.map((s) => <SkillRow key={s.name} skill={s} tone="good" />)}</ul> : <p className="mt-4 text-[13.5px] text-app-muted">Nothing measured yet. Your first Arena mission starts building this.</p>}
        </section>
        <section className={CARD} aria-labelledby="lag">
          <h3 id="lag" className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Where you&apos;re lagging</h3>
          {o.lagging.length ? <ul className="mt-4 flex flex-col gap-4">{o.lagging.map((s) => <SkillRow key={s.name} skill={s} tone="gap" />)}</ul> : <p className="mt-4 text-[13.5px] text-app-muted">No measured skill is below its target. Measure more skills to see what to improve.</p>}
          <Link href="/dashboard/skills?view=gaps" className="mt-4 inline-flex items-center gap-1 text-[13px] font-bold text-[var(--m-ink)] hover:underline">Full gap analysis <ArrowRight size={14} aria-hidden /></Link>
        </section>
        <section className="flex flex-col rounded-2xl border border-[var(--m-ink)] bg-[var(--m-ground)] p-5" aria-labelledby="next">
          <h3 id="next" className="font-lp-display text-[17px] font-bold text-[var(--m-ink)]">Do this next</h3>
          {o.next ? (
            <>
              <p className="mt-3 font-lp-display text-[20px] font-bold leading-tight text-[var(--m-ink)]">{o.next.reason === "gap" ? `Level up ${o.next.name}` : `Measure ${o.next.name}`}</p>
              <p className="mt-1.5 text-[13.5px] text-app-muted">
                {o.next.reason === "gap" ? `You're at ${o.next.score}% and ${o.roleName} roles ask for ${o.next.target}%. It is the biggest lever on your readiness.` : `It matters a lot for ${o.roleName} and nothing has measured it yet. One Arena mission will.`}
              </p>
              <div className="mt-auto flex flex-wrap gap-2 pt-4">
                <Link href="/arena" className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--m-ink)] px-4 py-2.5 text-[13px] font-bold text-white transition-transform hover:-translate-y-0.5 motion-reduce:hover:translate-y-0"><Swords size={14} aria-hidden />Start an Arena mission</Link>
                <Link href="/skillstudio" className="inline-flex items-center rounded-lg border border-[var(--m-ink)] px-4 py-2.5 text-[13px] font-bold text-[var(--m-ink)]">Learn it first</Link>
              </div>
            </>
          ) : <p className="mt-3 text-[13.5px] text-app-muted">You&apos;re on target everywhere we can measure. Keep adding proof in Arena.</p>}
        </section>
      </div>

      <ul className="grid grid-cols-3 gap-3" aria-label="At a glance">
        {stats.map((s) => <li key={s.label} className="rounded-xl border border-[var(--m-rule)] bg-white px-4 py-3"><p className="truncate font-lp-display text-[20px] font-bold text-[var(--m-ink)]">{s.value}</p><p className="text-[12px] text-app-muted">{s.label}</p></li>)}
      </ul>
    </div>
  );
}
