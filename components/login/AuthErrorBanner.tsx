"use client";

import { AlertCircle, WifiOff } from "lucide-react";
import { AuthOutcome } from "./auth";

type ErrorStatus = Exclude<AuthOutcome["status"], "success">;

interface AuthErrorBannerProps {
  status: ErrorStatus;
  onResendVerification?: () => void;
}

const COPY: Record<ErrorStatus, { title: string; body: string }> = {
  "invalid-credentials": {
    title: "Incorrect email or password",
    body: "Email or password is incorrect. Please try again.",
  },
  unverified: {
    title: "Account not verified",
    body: "Your account needs verification before you can continue.",
  },
  "pending-approval": {
    title: "Approval pending",
    body: "Your institution access is pending approval.",
  },
  "network-error": {
    title: "Connection problem",
    body: "Something went wrong. Please check your connection and try again.",
  },
};

export function AuthErrorBanner({ status, onResendVerification }: AuthErrorBannerProps) {
  const copy = COPY[status];
  const Icon = status === "network-error" ? WifiOff : AlertCircle;

  return (
    <div
      role="alert"
      className="flex items-start gap-3 rounded border border-lp-error/30 bg-lp-error-container/40 px-4 py-3 font-lp-body text-lp-body-sm"
    >
      <Icon size={17} className="mt-0.5 shrink-0 text-lp-error" aria-hidden="true" />
      <div>
        <p className="font-medium text-lp-text-ink">{copy.title}</p>
        <p className="mt-0.5 text-lp-on-surface-variant">{copy.body}</p>
        {status === "unverified" && onResendVerification && (
          <button
            type="button"
            onClick={onResendVerification}
            className="mt-2 font-lp-mono text-lp-label-sm font-medium text-lp-accent-indigo underline-offset-2 hover:underline"
          >
            Resend verification
          </button>
        )}
      </div>
    </div>
  );
}
