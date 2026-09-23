import type { Metadata } from "next";
import { AuthLayout } from "@/components/login/AuthLayout";
import { SignupForm } from "@/components/login/SignupForm";

export const metadata: Metadata = {
  title: "Create your account — Capabilio AI",
  description: "Start building your verified career profile with Capabilio AI.",
};

export default function SignupPage() {
  return (
    <AuthLayout>
      <SignupForm />
    </AuthLayout>
  );
}
