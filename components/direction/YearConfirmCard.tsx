"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { GraduationCap, Loader2 } from "lucide-react";

interface Props {
  startYear: number | null;
  endYear: number | null;
  computedYear: number | null;
  overrideYear: number | null;
  /** Settings page: open straight in edit mode. */
  startEditing?: boolean;
}

const INPUT =
  "w-24 rounded-lg border border-app-border bg-white px-3 py-1.5 font-lp-body text-[13px] text-app-charcoal focus:border-app-orange focus:outline-none";
const ordinal = (n: number) => ({ 1: "1st", 2: "2nd", 3: "3rd" })[n as 1 | 2 | 3] ?? `${n}th`;

/** Asks the student to confirm the computed year — never applied silently (backlogs, gap years, repeated years). */
export function YearConfirmCard({ startYear, endYear, computedYear, overrideYear, startEditing = false }: Props) {
  const router = useRouter();
  const missing = startYear == null || endYear == null;
  const [editing, setEditing] = useState(missing || startEditing);
  const [start, setStart] = useState(startYear?.toString() ?? "");
  const [end, setEnd] = useState(endYear?.toString() ?? "");
  const [override, setOverride] = useState(overrideYear?.toString() ?? "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function save(body: { startYear: number; endYear: number; currentYearOverride: number | null }) {
    setSaving(true);
    setError(null);
    const res = await fetch("/api/direction/year", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    setSaving(false);
    if (!res.ok) {
      setError(((await res.json().catch(() => null)) as { error?: string } | null)?.error ?? "Could not save — try again.");
      return;
    }
    router.refresh();
  }

  const submitEdit = () =>
    save({
      startYear: Number(start),
      endYear: Number(end),
      currentYearOverride: override === "" ? null : Number(override),
    });

  return (
    <div className="mb-5 rounded-xl border border-app-border bg-white p-4" role="region" aria-label="Confirm your year">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-app-orange-container text-app-orange">
          <GraduationCap size={16} />
        </span>
        <div className="min-w-0 flex-1">
          {!editing && computedYear != null && startYear != null && endYear != null ? (
            <>
              <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">
                Is this right? We think you&apos;re in your {ordinal(computedYear)} year ({startYear}–{endYear}).
              </p>
              <p className="mt-0.5 font-lp-body text-[12px] text-app-muted">
                Worked out from your start year and your college&apos;s academic cycle. Backlogs, gap years and repeated
                years can make it wrong — correct it if so.
              </p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => save({ startYear, endYear, currentYearOverride: overrideYear })}
                  className="rounded-lg bg-app-charcoal px-3.5 py-1.5 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : "Yes, that's right"}
                </button>
                <button
                  type="button"
                  onClick={() => setEditing(true)}
                  className="rounded-lg border border-app-border px-3.5 py-1.5 font-lp-body text-[12.5px] font-medium text-app-charcoal"
                >
                  Change
                </button>
              </div>
            </>
          ) : (
            <>
              <p className="font-lp-body text-[13.5px] font-semibold text-app-charcoal">
                {missing ? "Tell us when your program starts and ends" : "Update your program years"}
              </p>
              <div className="mt-3 flex flex-wrap items-end gap-3">
                <label className="font-lp-mono text-[11px] text-app-muted">
                  Start year
                  <input className={`${INPUT} mt-1 block`} inputMode="numeric" value={start} onChange={(e) => setStart(e.target.value)} placeholder="2024" />
                </label>
                <label className="font-lp-mono text-[11px] text-app-muted">
                  End year
                  <input className={`${INPUT} mt-1 block`} inputMode="numeric" value={end} onChange={(e) => setEnd(e.target.value)} placeholder="2028" />
                </label>
                <label className="font-lp-mono text-[11px] text-app-muted">
                  Current year (override)
                  <select className={`${INPUT} mt-1 block w-44`} value={override} onChange={(e) => setOverride(e.target.value)}>
                    <option value="">Use computed</option>
                    {[1, 2, 3, 4, 5, 6].map((n) => (
                      <option key={n} value={n}>
                        Year {n}
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  disabled={saving}
                  onClick={submitEdit}
                  className="rounded-lg bg-app-charcoal px-3.5 py-2 font-lp-body text-[12.5px] font-semibold text-white disabled:opacity-60"
                >
                  {saving ? <Loader2 size={13} className="animate-spin" /> : "Save"}
                </button>
              </div>
            </>
          )}
          {error && <p className="mt-2 font-lp-body text-[12px] text-app-orange" role="alert">{error}</p>}
        </div>
      </div>
    </div>
  );
}
