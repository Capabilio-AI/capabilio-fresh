import type { Metadata } from "next";
import { WaitlistPage } from "@/components/onboarding/WaitlistPage";

export const metadata: Metadata = { title: "Executive early access — Capabilio AI" };

export default function ExecutivePage() {
  return <WaitlistPage id="executive" />;
}
