import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { requireAuthedUser } from "@/lib/supabase/auth";
import { createServiceClient } from "@/lib/supabase/service";
import { canAttemptTier, TIERS, type TierNumber } from "@/lib/languages/tiers";
import { PROOF_AREAS, PROOF_READY, loadProofSet, loadProvenTiers, type ProofArea } from "@/lib/languages/tier-proof";
import { TierProofScreen } from "@/components/skillstudio/proof/TierProofScreen";
import "@/components/skillstudio/learn/studio.css";

export const metadata: Metadata = { title: "Tier proof | SkillStudio | Capabilio AI" };

/** A tier's proof test. Anyone who may not take it (wrong area, tier below not proven, no problems ready) goes back to Courses. */
export default async function ProofPage({ searchParams }: { searchParams: Promise<{ area?: string; tier?: string }> }) {
  const { user } = await requireAuthedUser();
  const { area, tier: rawTier } = await searchParams;
  const tier = Number(rawTier);
  if (!PROOF_AREAS.includes(area as ProofArea) || !Number.isInteger(tier) || tier < 1 || tier > 4 || !PROOF_READY.includes(area as ProofArea)) redirect("/skillstudio/courses");
  const service = createServiceClient();
  const proven = await loadProvenTiers(service, user.id, area as ProofArea);
  if (!canAttemptTier(tier as TierNumber, proven) || proven.includes(tier as TierNumber)) redirect("/skillstudio/courses");
  const set = await loadProofSet(service, user.id, tier as TierNumber);
  if (!set) redirect("/skillstudio/courses");
  return <TierProofScreen area={area as ProofArea} tier={tier as TierNumber} tierLabel={TIERS[tier - 1].label} problems={set.problems} />;
}
