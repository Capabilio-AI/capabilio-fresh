"use client";

import { useEffect, useRef, useState } from "react";
import { Compass } from "lucide-react";
import { dismissCareerDirectionIntro } from "@/app/(app)/dashboard/actions";
import type { RecommendationExplanation } from "@/lib/career/explain-recommendation";

interface Props {
  statedInterest: string;
  recommendedRole: string;
  readiness: number;
  explanation: RecommendationExplanation;
}

function strengthPhrase(explanation: RecommendationExplanation): string {
  switch (explanation.reasonKind) {
    case "skills":
      return ` — you're already strong in ${explanation.strongestSkills.join(", ")}`;
    case "closest-gap":
      return explanation.closestGapSkill ? ` — ${explanation.closestGapSkill} is the skill closest to your target level` : "";
    case "interest":
      return " — it's the direction you scored highest interest in among the paths we compare against";
    case "none":
      return "";
  }
}

export function CareerDirectionExplainerModal({ statedInterest, recommendedRole, readiness, explanation }: Props) {
  const [visible, setVisible] = useState(true);
  const [dismissing, setDismissing] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    panelRef.current?.focus();
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") dismiss();
    }
    document.addEventListener("keydown", onKeyDown);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.body.style.overflow = "";
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- dismiss is stable enough for a one-time mount effect
  }, []);

  function dismiss() {
    if (dismissing) return;
    setDismissing(true);
    setVisible(false);
    void dismissCareerDirectionIntro({
      statedInterest,
      matchesStatedInterest: explanation.matchesStatedInterest,
    });
  }

  if (!visible) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={dismiss} aria-hidden="true" />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby="career-direction-intro-title"
        tabIndex={-1}
        className="relative w-full max-w-md rounded-2xl border border-app-border bg-white p-6 shadow-2xl outline-none sm:p-7"
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-full bg-app-orange-container text-app-orange">
          <Compass size={20} />
        </span>

        <h2 id="career-direction-intro-title" className="mt-4 font-lp-display text-[19px] font-semibold text-app-charcoal">
          {explanation.matchesStatedInterest ? "Your interest and your strengths line up" : "Your career direction, explained"}
        </h2>

        <p className="mt-2 font-lp-body text-[13.5px] leading-relaxed text-app-muted">
          Capabilio recommends a direction based on two things: what you told us you want to explore, and what your
          assessment shows you can currently do. Those aren&apos;t always the same career — and that&apos;s expected,
          not a failure.
        </p>

        <div className="mt-4 rounded-xl bg-app-background p-4">
          <p className="font-lp-body text-[13px] text-app-charcoal">
            You told us you&apos;re interested in <span className="font-semibold">{statedInterest}</span>.
          </p>
          <p className="mt-2 font-lp-body text-[13px] text-app-charcoal">
            {explanation.matchesStatedInterest ? (
              <>
                Based on your results, <span className="font-semibold">{recommendedRole}</span> is also where your
                assessment shows the strongest current fit — {readiness}% ready.
              </>
            ) : (
              <>
                Based on your results, <span className="font-semibold">{recommendedRole}</span> is your strongest
                starting direction right now{strengthPhrase(explanation)}.
              </>
            )}
          </p>
        </div>

        {!explanation.matchesStatedInterest && (
          <p className="mt-3 font-lp-body text-[12.5px] leading-relaxed text-app-muted">
            {statedInterest} is still on your radar — we&apos;ve saved it as a path you can revisit as your skills
            develop.
          </p>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-5 w-full rounded-lg bg-app-charcoal px-4 py-3 font-lp-body text-[13.5px] font-semibold text-white transition-transform hover:-translate-y-0.5"
        >
          Got it — see my results
        </button>
      </div>
    </div>
  );
}
