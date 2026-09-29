import type { Metadata } from "next";
import { ComingSoon } from "@/components/onboarding/ComingSoon";
import { ONBOARDING_PATHS } from "@/lib/onboarding/paths";

export const metadata: Metadata = { title: "Working Professional — Capabilio AI" };

// Future signup fields (NOT built; no form, upload or storage in this task):
// first name, last name, email, password, confirm password, resume upload.
const path = ONBOARDING_PATHS.find((p) => p.id === "professional")!;

export default function ProfessionalPage() {
  return <ComingSoon title={path.title} tagline={path.tagline} subtext={path.subtext} />;
}
