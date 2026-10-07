"use client";

import { useEffect, useState } from "react";

interface Prefs {
  discoverable: boolean;
  showCareer: boolean;
}

function Row({ id, label, hint, checked, onChange, disabled }: { id: string; label: string; hint: string; checked: boolean; onChange: (v: boolean) => void; disabled: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 py-3">
      <div>
        <label htmlFor={id} className="font-lp-body text-[13.5px] font-medium text-app-charcoal">{label}</label>
        <p className="mt-0.5 font-lp-body text-[12px] text-app-muted">{hint}</p>
      </div>
      <input id={id} type="checkbox" role="switch" checked={checked} disabled={disabled} onChange={(e) => onChange(e.target.checked)} className="mt-1 h-4 w-4 shrink-0" />
    </div>
  );
}

/** What other people can see of you on Pulse. */
export function PulsePrivacy() {
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let live = true;
    fetch("/api/pulse/privacy")
      .then((r) => (r.ok ? (r.json() as Promise<Prefs>) : Promise.reject(new Error("bad"))))
      .then((p) => live && setPrefs(p))
      .catch(() => live && setError("Couldn't load your privacy settings."));
    return () => {
      live = false;
    };
  }, []);

  async function save(patch: Partial<Prefs>) {
    if (!prefs) return;
    const before = prefs;
    setPrefs({ ...prefs, ...patch });
    setBusy(true);
    setError(null);
    const res = await fetch("/api/pulse/privacy", { method: "PATCH", headers: { "Content-Type": "application/json" }, body: JSON.stringify(patch) }).catch(() => null);
    setBusy(false);
    if (!res?.ok) {
      setPrefs(before);
      setError("Couldn't save. Try again.");
    }
  }

  if (!prefs) return <p className="py-3 font-lp-body text-[12.5px] text-app-muted" role={error ? "alert" : undefined}>{error ?? "Loading…"}</p>;
  return (
    <div className="divide-y divide-app-border">
      <Row id="pp-discover" label="Appear in search and suggestions" hint="When off, only people who already follow you can find you by name." checked={prefs.discoverable} disabled={busy} onChange={(v) => void save({ discoverable: v })} />
      <Row id="pp-career" label="Show my career goal" hint="Shows “Aspiring AI/ML Engineer” under your name on Pulse, taken from the goal you set in your dashboard." checked={prefs.showCareer} disabled={busy} onChange={(v) => void save({ showCareer: v })} />
      {error && <p role="alert" className="pt-3 font-lp-body text-[12px] text-app-rose">{error}</p>}
    </div>
  );
}
