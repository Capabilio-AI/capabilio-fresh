"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowRight, RotateCcw } from "lucide-react";
import type { RoleOption } from "@/lib/assess/roles";
import type { PlanAInsights } from "@/lib/careers/plan-a-insights";
import { ApiError, assessApi } from "../api";
import { Button } from "../ui/Button";
import { AssessScope } from "../shell/AssessScope";
import { AssessTopBar } from "../shell/AssessTopBar";
import { RoleEntryStep } from "./RoleEntryStep";

type Picked = { careerId: string; name: string; typed?: string };

/**
 * Plan B "Change career role", in the order the student asked for: keywords for the new role, then everything we know about their current
 * (Plan A) role and an explicit confirmation, and only then the new role's assessment. Nothing changes until the assessment is completed.
 */
export function RoleSwitchFlow({ roles, insights }: { roles: RoleOption[]; insights: PlanAInsights }) {
  const [picked, setPicked] = useState<Picked | null>(null);
  return (
    <AssessScope stage="role">
      <AssessTopBar stage="role" back={picked ? { label: "Choose a different role", onClick: () => setPicked(null) } : { label: "Back to dashboard", href: "/dashboard" }} />
      <main id="main">
        {picked ? (
          <ConfirmSwitch insights={insights} picked={picked} newRole={picked.name} onBack={() => setPicked(null)} />
        ) : (
          <RoleEntryStep roles={roles} switchingFrom={insights.role} onPicked={setPicked} onConfirmed={() => undefined} />
        )}
      </main>
    </AssessScope>
  );
}

const pct = (n: number | null) => (n === null ? "–" : `${Math.round(n)}%`);

function ConfirmSwitch({ insights, picked, newRole, onBack }: { insights: PlanAInsights; picked: Picked; newRole: string; onBack: () => void }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const confirm = async () => {
    setBusy(true);
    setError(null);
    try {
      await assessApi.startRoleSwitch(picked.careerId, picked.typed);
      router.push("/assessment?plan=b");
    } catch (e) {
      setBusy(false);
      setError(e instanceof ApiError ? e.message : "We couldn't save that. Please try again.");
    }
  };

  return (
    <section className="mx-auto w-full max-w-3xl px-4 pb-16 pt-8 sm:pt-12" aria-labelledby="switch-title">
      <motion.div initial={{ opacity: 0, y: 14 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }} className="text-center">
        <h1 id="switch-title" className="mx-auto max-w-2xl text-balance font-lp-display text-[34px] font-bold leading-[1.08] tracking-tight text-[var(--m-ink)] sm:text-[46px]">Before you leave {insights.role}</h1>
        <p className="mx-auto mt-3 max-w-xl text-pretty text-[16px] leading-relaxed text-[var(--m-muted)]">This is everything Capabilio has measured for your current role. Moving to <strong className="text-[var(--m-ink)]">{newRole}</strong> means a fresh assessment and a fresh rating.</p>
      </motion.div>

      <div className="a-glass mt-8 rounded-[2rem] p-6 sm:p-8">
        {insights.hasAssessment ? (
          <>
            <dl className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <Stat label="Role rating" value={insights.rating === null ? "–" : String(insights.rating)} />
              <Stat label="Readiness" value={pct(insights.readiness)} />
              <Stat label="Proven by work" value={pct(insights.proven)} />
              <Stat label="Skills measured" value={`${insights.measuredSkills}/${insights.totalSkills}`} />
            </dl>
            <div className="mt-7 grid gap-6 sm:grid-cols-2">
              <List title="Your strongest skills" empty="No skill has been measured yet." rows={insights.strongest.map((s) => ({ name: s.name, note: `${s.score}/100` }))} />
              <List title="Biggest gaps for this role" empty="No gaps found." rows={insights.gaps.map((g) => ({ name: g.name, note: g.score === null ? "not measured" : `${g.score}/100` }))} />
            </div>
            {insights.common.length > 0 && (
              <div className="mt-7">
                <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--m-muted)]">Common assessment</h2>
                <ul className="mt-2 grid gap-2 sm:grid-cols-2">{insights.common.map((c) => <li key={c.label} className="flex justify-between rounded-2xl bg-white/60 px-4 py-2.5 text-[14px] font-bold text-[var(--m-ink)]"><span>{c.label}</span><span className="tabular-nums">{c.score}/100</span></li>)}</ul>
              </div>
            )}
          </>
        ) : (
          <p className="text-[15px] leading-relaxed text-[var(--m-muted)]">You have not taken the {insights.role} assessment yet, so there is no rating or skill graph to lose. Your roadmap for {insights.role} stays on record.</p>
        )}

        <div className="mt-7 flex gap-3 rounded-2xl bg-[var(--m-accent-soft)] p-4 text-[14px] leading-relaxed text-[var(--m-ink)]">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-[var(--m-accent-ink)]" aria-hidden />
          <p><strong>What happens next.</strong> {insights.role} stays your main role until you finish the {newRole} assessment. Once you do, {newRole} becomes your main role across your roadmap, SkillStudio, Arena and dashboard, and {insights.role} is kept on record as your previous role. Plan B can be answered once.</p>
        </div>

        {error && <p role="alert" className="mt-4 text-center text-[14px] font-bold text-[var(--m-ink)]">{error}</p>}
        <div className="mt-7 flex flex-col-reverse items-center justify-center gap-3 sm:flex-row">
          <Button variant="ghost" onClick={onBack} icon={<RotateCcw className="h-4 w-4" aria-hidden />}>Choose a different role</Button>
          <Button variant="accent" size="lg" onClick={() => void confirm()} loading={busy} iconAfter={<ArrowRight className="h-4 w-4" aria-hidden />}>Yes, move to {newRole} and take the assessment</Button>
        </div>
      </div>
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/60 px-4 py-3 text-center">
      <dt className="text-[12px] font-bold uppercase tracking-wider text-[var(--m-muted)]">{label}</dt>
      <dd className="mt-1 font-lp-display text-[28px] font-bold tabular-nums text-[var(--m-ink)]">{value}</dd>
    </div>
  );
}

function List({ title, rows, empty }: { title: string; rows: { name: string; note: string }[]; empty: string }) {
  return (
    <div>
      <h2 className="text-[13px] font-bold uppercase tracking-wider text-[var(--m-muted)]">{title}</h2>
      {rows.length === 0 ? <p className="mt-2 text-[14px] text-[var(--m-muted)]">{empty}</p> : (
        <ul className="mt-2 space-y-1.5">{rows.map((r) => <li key={r.name} className="flex justify-between gap-3 text-[14.5px] text-[var(--m-ink)]"><span className="font-bold">{r.name}</span><span className="tabular-nums text-[var(--m-muted)]">{r.note}</span></li>)}</ul>
      )}
    </div>
  );
}
