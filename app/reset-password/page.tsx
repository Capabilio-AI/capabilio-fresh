import type { Metadata } from "next";
import Image from "next/image";
import { CardChrome } from "@/components/login/CardChrome";
import { ResetPasswordForm } from "@/components/login/ResetPasswordForm";

export const metadata: Metadata = {
  title: "Reset password — Capabilio AI",
  description: "Set a new password for your Capabilio AI account.",
};

export default function ResetPasswordPage() {
  return (
    <div className="lp-bg-grid flex min-h-screen flex-col items-center justify-center bg-lp-surface-subtle px-5 py-12 sm:px-8">
      <a href="/" className="mb-8 flex items-center gap-2.5">
        <Image
          src="/logo-mark.jpg"
          alt="Capabilio AI"
          width={32}
          height={32}
          className="h-8 w-8 rounded object-cover"
          priority
        />
        <span className="font-lp-display text-base font-semibold tracking-tight text-lp-text-ink">
          Capabilio <span className="text-lp-accent-ochre">AI</span>
        </span>
      </a>
      <CardChrome label="capabilio / password-reset">
        <ResetPasswordForm />
      </CardChrome>
    </div>
  );
}
