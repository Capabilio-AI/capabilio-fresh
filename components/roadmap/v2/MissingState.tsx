import Link from "next/link";
import { Info } from "lucide-react";
import type { RoadmapOutcome } from "@/lib/roadmap-engine/service";
import type { IntentView, SuggestionView, CareerRef } from "@/lib/careers/intent";
import { GoalPicker } from "./GoalPicker";
import { RegulationForm } from "./RegulationForm";

type Missing = Exclude<RoadmapOutcome, { status: "READY" }>;
interface Ctx { intent: IntentView; careers: CareerRef[]; suggestions: SuggestionView[] }

/** Each missing-data case says exactly what is missing and what to do — and never shows a made-up roadmap. */
export function MissingState({ outcome, ctx }: { outcome: Missing; ctx: Ctx }) {
  let title = "";
  let body: React.ReactNode = null;
  switch (outcome.status) {
    case "MISSING_ACADEMIC_POSITION":
      title = outcome.reason === "no_membership" ? "Join your college to get a curriculum-based roadmap" : "Confirm your program years";
      body = outcome.reason === "no_membership"
        ? <p>Your roadmap is built from your college&apos;s published curriculum. You aren&apos;t linked to a college yet, so there is nothing to base it on.</p>
        : <p>We need to know which year you&apos;re in so we know which subjects are yours. <Link href="/settings/direction" className="text-app-blue hover:underline">Confirm your years</Link>.</p>;
      break;
    case "MISSING_CURRICULUM":
      title = outcome.reason === "regulation" ? "No curriculum for your regulation yet" : "Your college hasn't published its curriculum yet";
      body = outcome.reason === "regulation"
        ? <><p>Your college has published a curriculum for your branch, but not for regulation <strong>{outcome.regulation}</strong>. We won&apos;t show you a different regulation&apos;s subjects. If that&apos;s not your regulation, correct it:</p><RegulationForm current={outcome.regulation} /></>
        : <><p>We won&apos;t guess what your subjects cover. Once your college publishes its curriculum for your branch, your roadmap appears here. If your syllabus has a regulation (like R23), set it so we match the right one:</p><RegulationForm current={null} /></>;
      break;
    case "MISSING_CAREER_GOAL":
      title = "Choose a career to build your roadmap";
      body = <><p className="mb-4">Pick the career you&apos;re aiming for, or tell us you&apos;re still exploring. You can change this any time.</p><GoalPicker {...ctx} /></>;
      break;
    case "MISSING_CAREER_REQUIREMENTS":
      title = `${outcome.careerName} doesn't have its skill requirements set up yet`;
      body = <><p className="mb-4">We can&apos;t compare you against a career until its required skills are defined, and we won&apos;t invent them. Try another career for now:</p><GoalPicker {...ctx} /></>;
      break;
  }
  return (
    <div className="rounded-2xl border border-dashed border-app-border bg-white p-6" role="status">
      <p className="flex items-center gap-2 font-lp-display text-[16px] font-semibold text-app-charcoal"><Info size={17} className="text-app-orange" aria-hidden /> {title}</p>
      <div className="mt-2 font-lp-body text-[13px] text-app-charcoal">{body}</div>
    </div>
  );
}
