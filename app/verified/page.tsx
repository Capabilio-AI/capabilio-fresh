import type { Metadata } from "next";
import { AuthLayout } from "@/components/login/AuthLayout";
import { VerifiedCard } from "@/components/login/VerifiedCard";
import { parseAuthPath } from "@/lib/onboarding/auth-path";

export const metadata: Metadata = {
  title: "Account verified — Capabilio AI",
  description: "Your Capabilio AI account is verified and ready.",
};

export default async function VerifiedPage({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  const path = parseAuthPath((await searchParams).path);
  return (
    <AuthLayout path={path}>
      <VerifiedCard path={path} />
    </AuthLayout>
  );
}
