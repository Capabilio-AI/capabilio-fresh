import type { Metadata } from "next";
import { WaitlistPage } from "@/components/onboarding/WaitlistPage";

export const metadata: Metadata = { title: "Working Professional early access — Capabilio AI" };

export default function ProfessionalPage() {
  return <WaitlistPage id="professional" />;
}
