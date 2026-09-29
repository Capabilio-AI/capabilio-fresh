import { AuthLayout } from "./AuthLayout";
import { AuthCard } from "./AuthCard";
import type { AuthPath } from "@/lib/onboarding/auth-path";

export function LoginScreen({ path = "student" }: { path?: AuthPath }) {
  return (
    <AuthLayout path={path}>
      <AuthCard path={path} />
    </AuthLayout>
  );
}
