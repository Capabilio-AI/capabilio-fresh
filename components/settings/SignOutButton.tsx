"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { signOut } from "@/components/login/auth";

export function SignOutButton() {
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);

  async function handleSignOut() {
    setSigningOut(true);
    await signOut();
    router.refresh();
    router.push("/login");
  }

  return (
    <button
      type="button"
      onClick={handleSignOut}
      disabled={signingOut}
      className="rounded-lg border border-app-border px-3.5 py-1.5 font-lp-mono text-[11.5px] font-semibold text-app-charcoal hover:bg-app-background disabled:opacity-60"
    >
      {signingOut ? "Signing out…" : "Sign out"}
    </button>
  );
}
