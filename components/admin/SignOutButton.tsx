"use client";

import { createClient } from "@/lib/supabase/client";

export function SignOutButton({ label = "Sign out and use another account" }: { label?: string }) {
  return (
    <button type="button" onClick={async () => { await createClient().auth.signOut(); window.location.assign("/admin/login"); }} className="rounded-full bg-[var(--m-ink)] px-5 py-2.5 font-lp-body text-[14px] font-bold text-white">{label}</button>
  );
}
