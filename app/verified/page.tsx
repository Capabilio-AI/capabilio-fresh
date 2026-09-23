import type { Metadata } from "next";
import { AuthLayout } from "@/components/login/AuthLayout";
import { VerifiedCard } from "@/components/login/VerifiedCard";

export const metadata: Metadata = {
  title: "Account verified — Capabilio AI",
  description: "Your Capabilio AI account is verified and ready.",
};

export default function VerifiedPage() {
  return (
    <AuthLayout>
      <VerifiedCard />
    </AuthLayout>
  );
}
