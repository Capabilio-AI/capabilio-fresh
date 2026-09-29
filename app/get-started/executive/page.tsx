import type { Metadata } from "next";
import { ComingSoon } from "@/components/onboarding/ComingSoon";
import { ONBOARDING_PATHS } from "@/lib/onboarding/paths";

export const metadata: Metadata = { title: "Executive — Capabilio AI" };

const path = ONBOARDING_PATHS.find((p) => p.id === "executive")!;

export default function ExecutivePage() {
  return <ComingSoon title={path.title} tagline={path.tagline} subtext={path.subtext} />;
}
