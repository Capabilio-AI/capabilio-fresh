"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap } from "lucide-react";

export interface RoleChoice {
  roleKey: string;
  label: string;
}

/**
 * "Still planning on Higher Studies?" — Continue changes nothing. Switch
 * retargets the active Arena domain role (server-side, config-driven); all
 * earlier Portfolio evidence is kept. Only offered when another role exists.
 */
export function HigherStudiesCheckin({ otherRoles }: { otherRoles: RoleChoice[] }) {
  const router = useRouter();
  const [picking, setPicking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function send(url: string, method: string, body: unknown) {
    setBusy(true);
    setError(null);
    const res = await fetch(url, { method, headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    setBusy(false);
    if (!res.ok) {
      setError("Could not save — try again.");
      return;
    }
    router.refresh();
  }

  return (
    <div className="rounded-xl border border-app-border bg-white p-4" role="region" aria-label="Higher studies check-in">
      <p className="flex items-center gap-2 font-lp-body text-[13.5px] font-semibold text-app-charcoal">
        <GraduationCap size={15} className="text-app-orange" /> Still planning on Higher Studies?
      </p>
      <p className="mt-1 font-lp-body text-[12.5px] text-app-muted">
        Or do you want to explore a different direction? Everything you&apos;ve earned so far stays in your Portfolio either way.
      </p>
      {!picking ? (
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" disabled={busy} onClick={() => send("/api/direction/dismiss", "POST", { prompt: "checkin" })} className="rounded-lg bg-app-charcoal px-3.5 py-1.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-60">
            Continue with Higher Studies
          </button>
          <button type="button" disabled={busy} onClick={() => setPicking(true)} className="rounded-lg border border-app-border px-3.5 py-1.5 font-lp-body text-[12.5px] font-medium text-app-charcoal">
            Switch direction
          </button>
        </div>
      ) : (
        <div className="mt-3">
          {otherRoles.length > 0 ? (
            <>
              <p className="font-lp-mono text-[11px] text-app-muted">New Arena domain role — only new activity counts toward it:</p>
              <div className="mt-2 flex flex-wrap gap-2">
                {otherRoles.map((r) => (
                  <button key={r.roleKey} type="button" disabled={busy} onClick={() => send("/api/direction/active-role", "PUT", { roleKey: r.roleKey })} className="rounded-lg border border-app-border px-3.5 py-1.5 font-lp-body text-[12.5px] font-medium text-app-charcoal hover:border-app-charcoal disabled:opacity-60">
                    {r.label}
                  </button>
                ))}
              </div>
            </>
          ) : (
            <p className="font-lp-body text-[12.5px] text-app-muted">
              No other Arena domain roles are available yet, so there is nothing to switch to right now. You can still change your overall direction in{" "}
              <a href="/settings/direction" className="text-app-blue hover:underline">Settings</a>.
            </p>
          )}
          <button type="button" onClick={() => setPicking(false)} className="mt-2 font-lp-mono text-[11px] text-app-muted underline-offset-2 hover:underline">
            Back
          </button>
        </div>
      )}
      {error && <p className="mt-2 font-lp-body text-[12px] text-app-orange" role="alert">{error}</p>}
    </div>
  );
}
