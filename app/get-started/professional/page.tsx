import type { Metadata } from "next";
import { WaitlistPage } from "@/components/onboarding/WaitlistPage";

export const metadata: Metadata = { title: "Working Professional early access — Capabilio AI" };

/**
 * The landing page still shows Working Professional as coming soon. Testers sign up at /signup?as=professional; once every check has passed,
 * this page goes back to redirecting there and the banner is removed (lib/onboarding/paths.ts).
 */
export default function ProfessionalPage() {
  return <WaitlistPage id="professional" />;
}
