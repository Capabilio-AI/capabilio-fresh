"use client";

import { useState } from "react";
import { requestPasswordReset } from "@/components/login/auth";

export function ChangePasswordButton({ email }: { email: string }) {
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  async function handleClick() {
    setSending(true);
    await requestPasswordReset(email);
    setSending(false);
    setSent(true);
  }

  if (sent) {
    return <span className="font-lp-mono text-[11.5px] text-app-success">Check your email</span>;
  }

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={sending}
      className="rounded-lg border border-app-border px-3.5 py-1.5 font-lp-mono text-[11.5px] font-semibold text-app-charcoal hover:bg-app-background disabled:opacity-60"
    >
      {sending ? "Sending…" : "Send reset link"}
    </button>
  );
}
