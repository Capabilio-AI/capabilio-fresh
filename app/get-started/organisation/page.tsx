import type { Metadata } from "next";
import { AuthLayout } from "@/components/login/AuthLayout";
import { OrganisationSignupForm } from "@/components/onboarding/OrganisationSignupForm";

export const metadata: Metadata = {
  title: "Register your organisation — Capabilio AI",
  description: "Apply for an organisation account. Accounts are approved manually.",
};

export default function OrganisationSignupPage() {
  return (
    <AuthLayout>
      <OrganisationSignupForm />
    </AuthLayout>
  );
}
