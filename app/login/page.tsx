import type { Metadata } from "next";
import { LoginScreen } from "@/components/login/LoginScreen";
import { parseAuthPath } from "@/lib/onboarding/auth-path";

export const metadata: Metadata = {
  title: "Sign in — Capabilio AI",
  description: "Sign in to continue your Capabilio AI journey.",
};

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ path?: string }> }) {
  return <LoginScreen path={parseAuthPath((await searchParams).path)} />;
}
