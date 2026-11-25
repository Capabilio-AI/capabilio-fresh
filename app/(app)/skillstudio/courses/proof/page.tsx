import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { TIERS, type TierNumber } from "@/lib/languages/tiers";
import { isProofArea, loadProofSet } from "@/lib/languages/tier-proof";
import { examGate } from "@/lib/languages/year-exam";
import { TierProofScreen } from "@/components/skillstudio/proof/TierProofScreen";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Tier proof | SkillStudio | Capabilio AI" };

/** A tier's proof test. Anyone who may not take it (wrong area, tier below not proven, no problems ready) goes back to Courses. */
export default async function ProofPage({ searchParams }: { searchParams: Promise<{ area?: string; tier?: string }> }) {
  const { user } = await requireAuthedUser();
  const { area, tier: rawTier } = await searchParams;
  const tier = Number(rawTier);
  if (!isProofArea(area) || !Number.isInteger(tier) || tier < 1 || tier > 4) redirect("/skillstudio/courses");
  const service = createServiceClient();
  const gate = await examGate(service, user.id, area, tier as TierNumber);
  if (!gate.ok || gate.proven.includes(tier as TierNumber)) redirect(area.startsWith("lang-") ? `/skillstudio/courses/${area.slice(5)}` : "/skillstudio/courses");
  const set = await loadProofSet(service, user.id, tier as TierNumber);
  if (!set) redirect("/skillstudio/courses");
  return <TierProofScreen area={area} tier={tier as TierNumber} tierLabel={TIERS[tier - 1].label} problems={set.problems} only={gate.language} />;
}
