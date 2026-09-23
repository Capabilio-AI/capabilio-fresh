import type { Metadata } from "next";
import { LoginScreen } from "@/components/login/LoginScreen";

export const metadata: Metadata = {
  title: "Sign in — Capabilio AI",
  description: "Sign in to continue your Capabilio AI journey.",
};

export default function LoginPage() {
  return <LoginScreen />;
}
