import { AuthLayout } from "@/components/login/AuthLayout";
import { WaitlistForm } from "./WaitlistForm";
import { ONBOARDING_PATHS } from "@/lib/onboarding/paths";

export function WaitlistPage({ id }: { id: "professional" | "executive" }) {
  const path = ONBOARDING_PATHS.find((p) => p.id === id)!;
  return (
    <AuthLayout path={id}>
      <WaitlistForm path={id} title={path.title} tagline={path.tagline} subtext={path.subtext} />
    </AuthLayout>
  );
}
