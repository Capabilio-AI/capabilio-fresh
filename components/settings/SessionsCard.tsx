"use client";

import { useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Laptop, Loader2 } from "lucide-react";
import { createClient } from "@/lib/supabase/client";
import { describeDevice } from "@/lib/settings/device";
import { SettingsCard, StatusPill } from "./SettingsCard";
import { BTN_PRIMARY, BTN_QUIET } from "./ui";

const subscribeNever = () => () => {};
const formatWhen = (iso: string) => new Date(iso).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" });

/** Where you're signed in. The auth service can end other sessions but not list them, so this shows this device and the controls that work. */
export function SessionsCard({ lastSignInAt }: { lastSignInAt: string | null }) {
  const router = useRouter();
  const [busy, setBusy] = useState<"others" | "global" | null>(null);
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // Browser-only values go through useSyncExternalStore so the server render and first client render agree, then the real values appear.
  const device = useSyncExternalStore(subscribeNever, () => describeDevice(navigator.userAgent), () => "This device");
  const signedInLabel = useSyncExternalStore(subscribeNever, () => (lastSignInAt ? formatWhen(lastSignInAt) : ""), () => "");

  async function end(scope: "others" | "global") {
    setBusy(scope);
    setMessage(null);
    const { error } = await createClient().auth.signOut({ scope });
    setBusy(null);
    if (error) return setMessage({ ok: false, text: "Couldn't sign out. Please try again." });
    if (scope === "global") {
      router.push("/login");
      return;
    }
    setMessage({ ok: true, text: "Signed out of every other device. They'll need your password again." });
  }

  return (
    <SettingsCard id="sess-h" title="Where you're signed in" description="If you used Capabilio on a shared or lost device, end those sessions here.">
      <div className="flex items-center gap-3 rounded-xl border border-[var(--m-rule)]! bg-[var(--m-ground)] px-4 py-3">
        <Laptop size={20} aria-hidden className="shrink-0 text-[var(--m-muted)]" />
        <div className="min-w-0 flex-1">
          <p className="font-lp-body text-[14px] font-bold text-[var(--m-ink)]">{device}</p>
          {signedInLabel && <p className="font-lp-body text-[12.5px] text-[var(--m-muted)]">Signed in {signedInLabel}</p>}
        </div>
        <StatusPill tone="on">This device</StatusPill>
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className={BTN_QUIET} onClick={() => end("others")} disabled={busy !== null}>
          {busy === "others" && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Sign out other devices
        </button>
        <button type="button" className={BTN_PRIMARY} onClick={() => end("global")} disabled={busy !== null}>
          {busy === "global" && <Loader2 size={14} className="animate-spin" aria-hidden />}
          Sign out everywhere
        </button>
      </div>
      {message && <p role="status" className={`mt-3 font-lp-body text-[13px] font-bold ${message.ok ? "text-[#0f6b3c]" : "text-[#b42318]"}`}>{message.text}</p>}
    </SettingsCard>
  );
}
