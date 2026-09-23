import { redirect } from "next/navigation";
import type { Metadata } from "next";
import { createClient } from "@/lib/supabase/server";
import { matchCareersForStudent } from "@/lib/career/match";
import { computeNextAction } from "@/lib/dashboard/next-action";
import { MentorChat } from "@/components/mentor/MentorChat";

export const metadata: Metadata = { title: "AI Mentor — Capabilio AI" };

function buildOpeningMessage(topCareer: string | null, gapSkill: string | null): string {
  if (!topCareer) {
    return "Hi — I'm your AI Mentor. Complete your diagnostic assessment and I'll have real context on where you stand. Ask me anything in the meantime.";
  }
  if (!gapSkill) {
    return `Hi — based on your profile, ${topCareer} is your strongest career match right now, and you're not far off on any single skill. What would you like to work on?`;
  }
  return `Hi — based on your profile, your biggest lever right now is ${gapSkill}, which moves your readiness for ${topCareer} more than anything else. Want a plan for closing it?`;
}

export default async function MentorPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const careerMatches = await matchCareersForStudent(supabase, user.id);
  const top = careerMatches[0] ?? null;
  const nextAction = computeNextAction(top);

  return (
    <div>
      <h1 className="font-lp-display text-[26px] font-semibold text-app-charcoal">AI Mentor</h1>
      <p className="mt-1 font-lp-body text-[13px] text-app-muted">
        Contextual guidance grounded in your real profile, assessment, and career direction.
      </p>

      <div className="mx-auto mt-6 max-w-2xl">
        <MentorChat openingMessage={buildOpeningMessage(top?.careerRole ?? null, nextAction?.skill ?? null)} />
      </div>
    </div>
  );
}
