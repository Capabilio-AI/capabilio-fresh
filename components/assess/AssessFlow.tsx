"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { CheckCircle2, LogOut } from "lucide-react";
import type { FlowSnapshot } from "@/lib/assess/flow";
import type { AssessmentResult } from "@/lib/assess/types";
import { AssessScope, type Stage } from "./shell/AssessScope";
import { AssessTopBar, type BackAction } from "./shell/AssessTopBar";
import { RoleEntryStep } from "./steps/RoleEntryStep";
import { StartFlow, type StartedSession } from "./steps/StartFlow";
import { QuestionRunner } from "./runner/QuestionRunner";
import { ResultPopup } from "./result/ResultPopup";
import { Button } from "./ui/Button";

type View =
  | { kind: "start" }
  | { kind: "run"; session: StartedSession }
  | { kind: "common-done"; result: AssessmentResult }
  | { kind: "career-done"; sessionId: string; result: AssessmentResult };

const STAGE_OF: Record<FlowSnapshot["stage"], Stage> = { "career-interest": "role", general: "common", career: "career", done: "results" };

/**
 * The assessment room. It owns three things only: which screen is showing, what the Back button means on it, and the leave-safely
 * dialog. Everything else lives in the step components, and everything the student sees as a number comes from the server.
 */
export function AssessFlow({ snapshot }: { snapshot: FlowSnapshot }) {
  const router = useRouter();
  const [view, setView] = useState<View>({ kind: "start" });
  const [leaving, setLeaving] = useState(false);

  const advance = useCallback(() => {
    setView({ kind: "start" });
    router.refresh();
  }, [router]);
  const onSubmitted = useCallback((result: AssessmentResult) => {
    setView((v) => (v.kind === "run" ? (result.layer === "GENERAL" ? { kind: "common-done", result } : { kind: "career-done", sessionId: v.session.sessionId, result }) : v));
  }, []);

  const stage: Stage = view.kind === "career-done" ? "results" : view.kind === "run" ? (view.session.layer === "CAREER" ? "career" : "common") : view.kind === "common-done" ? "common" : STAGE_OF[snapshot.stage];

  let back: BackAction | null;
  if (view.kind === "run") back = { label: "Back", onClick: () => setLeaving(true) };
  else if (view.kind === "career-done") back = null;
  // Until the assessment is finished the dashboard is locked, so there is nowhere useful to go "back" to on the first steps.
  else if (view.kind === "common-done" || snapshot.stage === "career-interest") back = null;
  else if (snapshot.stage === "done") back = { label: "Back to dashboard", href: "/dashboard" };
  else back = { label: "Change role", href: "/assessment?step=role" };

  return (
    <AssessScope stage={stage}>
      <AssessTopBar stage={stage} back={back} />
      <main id="main">
        <Screen snapshot={snapshot} view={view} setView={setView} onSubmitted={onSubmitted} advance={advance} />
      </main>
      {leaving && <LeaveDialog onStay={() => setLeaving(false)} onLeave={() => router.push("/dashboard")} />}
    </AssessScope>
  );
}

function Screen({ snapshot, view, setView, onSubmitted, advance }: { snapshot: FlowSnapshot; view: View; setView: (v: View) => void; onSubmitted: (r: AssessmentResult) => void; advance: () => void }) {
  if (view.kind === "run") return <QuestionRunner sessionId={view.session.sessionId} initial={view.session.state} onSubmitted={onSubmitted} />;
  if (view.kind === "career-done" && view.result.elo && view.result.career) return <ResultPopup sessionId={view.sessionId} result={view.result} />;
  if (view.kind === "common-done") return <CommonDone result={view.result} onContinue={advance} />;

  switch (snapshot.stage) {
    case "career-interest":
      return <RoleEntryStep roles={snapshot.roleOptions} onConfirmed={advance} />;
    case "general":
      return (
        <StartFlow
          layer="GENERAL"
          items={snapshot.commonSections.map((s) => ({ name: s.label }))}
          sectionQuestions={Object.fromEntries(snapshot.commonSections.map((s) => [s.label, s.questions]))}
          total={snapshot.general.total}
          onReady={(session) => setView({ kind: "run", session })}
        />
      );
    case "career":
      if (!snapshot.assess) return <Notice title="This role isn't available right now" body="Choose another role to continue." href="/assessment?step=role" cta="Choose a role" />;
      return (
        <StartFlow
          key={snapshot.assess.career.id}
          layer="CAREER"
          careerId={snapshot.assess.career.id}
          careerName={snapshot.assess.career.name}
          items={snapshot.assess.skills}
          total={snapshot.assess.total}
          resuming={snapshot.hasOpenCareerSession}
          onReady={(session) => setView({ kind: "run", session })}
        />
      );
    default:
      return (
        <Notice
          title="Your assessment is complete"
          body={snapshot.hasCareerResult ? "Your rating, skill graph and roadmap are ready." : "You can take the career assessment whenever you like. It builds your skill graph and role rating."}
          href={snapshot.hasCareerResult ? "/dashboard" : "/assessment?retake=1"}
          cta={snapshot.hasCareerResult ? "Go to dashboard" : "Take the career assessment"}
        />
      );
  }
}

function CommonDone({ result, onContinue }: { result: AssessmentResult; onContinue: () => void }) {
  return (
    <section className="mx-auto w-full max-w-2xl px-4 pb-16 pt-8 sm:pt-14" aria-labelledby="common-done-title">
      <motion.div initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }} className="a-glass rounded-[2rem] p-7 text-center sm:p-10">
        <span className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--ok)] text-white shadow-[0_16px_28px_-14px_var(--ok)]"><CheckCircle2 className="h-7 w-7" aria-hidden /></span>
        <h1 id="common-done-title" className="mt-4 font-lp-display text-[34px] font-bold leading-tight text-[var(--m-ink)]">Common assessment done</h1>
        <p className="mx-auto mt-2 max-w-md text-[15px] text-[var(--m-muted)]">That was the baseline. Next is the part that builds your role rating and skill graph.</p>
        <ul className="mt-6 space-y-4 text-left">
          {(result.general ?? []).map((b) => (
            <li key={b.section}>
              <div className="flex items-baseline justify-between text-[15px] font-bold text-[var(--m-ink)]"><span>{b.label}</span><span className="tabular-nums">{b.score ?? "—"}<span className="text-[12px] font-normal text-[var(--m-muted)]"> /100</span></span></div>
              <div className="mt-1.5 h-3 overflow-hidden rounded-full bg-[var(--m-ink)]/10" role="meter" aria-label={b.label} aria-valuemin={0} aria-valuemax={100} aria-valuenow={b.score ?? 0}>
                <motion.div className="h-full rounded-full bg-gradient-to-r from-[var(--hue-a)] to-[var(--hue-b)]" initial={{ width: 0 }} animate={{ width: `${b.score ?? 0}%` }} transition={{ duration: 0.9, delay: 0.2, ease: [0.16, 1, 0.3, 1] }} />
              </div>
            </li>
          ))}
        </ul>
        <Button variant="accent" size="lg" onClick={onContinue} className="mt-8">Continue to career assessment</Button>
      </motion.div>
    </section>
  );
}

function Notice({ title, body, href, cta }: { title: string; body: string; href: string; cta: string }) {
  return (
    <section className="mx-auto w-full max-w-xl px-4 pb-16 pt-12">
      <div className="a-glass rounded-[2rem] p-8 text-center">
        <CheckCircle2 className="mx-auto h-9 w-9 text-[var(--ok)]" aria-hidden />
        <h1 className="mt-3 font-lp-display text-[30px] font-bold text-[var(--m-ink)]">{title}</h1>
        <p className="mt-2 text-[15px] text-[var(--m-muted)]">{body}</p>
        <Link href={href} className="mt-6 inline-flex rounded-full bg-[var(--m-ink)] px-6 py-3 text-[14.5px] font-bold text-white transition-transform hover:-translate-y-0.5 active:scale-[0.97]">{cta}</Link>
      </div>
    </section>
  );
}

/** Back mid-run: answers are final, so there is nothing to go back to. Say so, and make leaving safe. */
function LeaveDialog({ onStay, onLeave }: { onStay: () => void; onLeave: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (d && !d.open) d.showModal();
  }, []);
  return (
    <dialog ref={ref} aria-labelledby="leave-title" onClose={onStay} onClick={(e) => e.target === ref.current && onStay()} className="m-auto w-[min(28rem,calc(100vw-2rem))] rounded-3xl border-0 bg-transparent p-0 backdrop:bg-[#17131f]/50 backdrop:backdrop-blur-sm">
      <div className="metro a-glass rounded-3xl p-6 sm:p-7" data-area="assess" style={{ fontFamily: "var(--font-metro), system-ui, sans-serif" }}>
        <h2 id="leave-title" className="font-lp-display text-[24px] font-bold text-[var(--m-ink)]">Leave the assessment?</h2>
        <p className="mt-2 text-[14.5px] leading-relaxed text-[var(--m-muted)]">Your progress is saved and you&apos;ll continue from this exact question. Answers you&apos;ve already given are final, so there&apos;s no going back to change them.</p>
        <div className="mt-6 flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
          <Button variant="secondary" onClick={onLeave} icon={<LogOut className="h-4 w-4" aria-hidden />}>Save &amp; exit</Button>
          <Button variant="primary" onClick={onStay} autoFocus>Keep going</Button>
        </div>
      </div>
    </dialog>
  );
}
