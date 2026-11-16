"use client";

import { LogOut } from "lucide-react";
import { createClient } from "@/lib/supabase/client";

const DEFAULT = "rounded-full bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[14px] font-bold text-white";

/** Ends this browser's session and returns to the console's own sign-in. */
export function SignOutButton({ label = "Sign out and use another account", className = DEFAULT, icon = false }: { label?: string; className?: string; icon?: boolean }) {
  return (
    <button type="button" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/admin/login"); }} className={className}>
      {icon && <LogOut size={15} aria-hidden />}{label}
    </button>
  );
}
