// The student's assessed skills for their role, shaped as the gap analysis input: score vs the level the role (the market) asks for.
import type { CareerProfile } from "./career-profile";
import type { CareerMatch } from "@/lib/career/skill-gap";

export function gapMatchFromProfile(profile: CareerProfile): CareerMatch | null {
  if (!profile.unlocked || profile.skills.length === 0) return null;
  const readiness = profile.readiness ?? 0;
  return {
    careerRole: profile.role?.name ?? "Your role",
    interestLevel: 0,
    overallReadiness: readiness,
    recommendation: readiness >= 85 ? "Ready" : readiness >= 60 ? "Explore" : "Long-term pathway",
    skillGaps: profile.skills.map((k) => ({
      skill: k.name,
      required: k.targetLevel,
      current: k.score,
      confidence: k.score === null ? "unassessed" : k.confidence === "HIGH" ? "high" : k.confidence === "MEDIUM" ? "medium" : "low",
      gap: k.targetLevel - (k.score ?? 0),
    })),
  };
}
