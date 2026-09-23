"use client";

import { FormEvent, useState } from "react";
import { Mail } from "lucide-react";
import { Modal } from "./Modal";
import { requestPasswordReset } from "./auth";

interface ForgotPasswordModalProps {
  open: boolean;
  onClose: () => void;
}

export function ForgotPasswordModal({ open, onClose }: ForgotPasswordModalProps) {
  const [email, setEmail] = useState("");
  const [sent, setSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const handleClose = () => {
    onClose();
    setTimeout(() => {
      setEmail("");
      setSent(false);
      setSubmitting(false);
    }, 200);
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    await requestPasswordReset(email);
    setSubmitting(false);
    setSent(true);
  };

  return (
    <Modal open={open} onClose={handleClose} titleId="forgot-password-title">
      {sent ? (
        <div className="pt-1 text-center">
          <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-lp-surface-subtle text-lp-accent-indigo">
            <Mail size={20} />
          </div>
          <h2 id="forgot-password-title" className="mt-4 font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
            Check your email
          </h2>
          <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">
            If an account exists for this email, we&apos;ve sent instructions to reset your
            password.
          </p>
          <button
            type="button"
            onClick={handleClose}
            className="mt-6 w-full rounded bg-lp-text-ink py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface"
          >
            Done
          </button>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="pt-1">
          <h2 id="forgot-password-title" className="font-lp-display text-lp-headline-sm font-semibold text-lp-text-ink">
            Reset your password
          </h2>
          <p className="mt-2 font-lp-body text-lp-body-sm leading-relaxed text-lp-text-muted">
            Enter the email associated with your Capabilio account and we&apos;ll send you a
            secure password reset link.
          </p>

          <label
            htmlFor="reset-email"
            className="mb-2 mt-6 block font-lp-body text-lp-body-sm font-medium text-lp-on-surface-variant"
          >
            Email address
          </label>
          <input
            id="reset-email"
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="Enter your email"
            autoComplete="email"
            className="w-full rounded border border-lp-border-hairline bg-lp-surface-card px-4 py-3 font-lp-body text-lp-body-sm text-lp-text-ink placeholder:text-lp-text-muted transition-colors focus:border-lp-accent-indigo focus:outline-none focus:ring-2 focus:ring-lp-accent-indigo/25"
          />

          <button
            type="submit"
            disabled={submitting}
            className="mt-5 flex w-full items-center justify-center gap-2 rounded bg-lp-text-ink py-3 font-lp-body text-lp-body-sm font-semibold text-lp-surface-card transition-colors hover:bg-lp-inverse-surface disabled:cursor-not-allowed disabled:opacity-60"
          >
            {submitting ? "Sending…" : "Send reset link"}
          </button>
        </form>
      )}
    </Modal>
  );
}
