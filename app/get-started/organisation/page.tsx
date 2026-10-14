import type { Metadata } from "next";
import { AuthLayout } from "@/components/login/AuthLayout";
import { OrganisationSignupForm } from "@/components/onboarding/OrganisationSignupForm";

export const metadata: Metadata = {
  title: "Register your organisation — Capabilio AI",
  description: "Apply for an organisation account. Accounts are approved manually.",
};

export default async function OrganisationSignupPage({ searchParams }: { searchParams: Promise<{ as?: string }> }) {
  const { as } = await searchParams;
  return (
    <AuthLayout path="organisation">
      <OrganisationSignupForm initialType={as === "company" ? "company" : "institution"} />
    </AuthLayout>
  );
}
